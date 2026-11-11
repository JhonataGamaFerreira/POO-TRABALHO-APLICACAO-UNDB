/**
 * Regras extraídas do back-end (`main.py`, commit b16a874). Funções puras.
 * Cada bloco indica a origem. Qualquer divergência com o back-end é um erro
 * aqui, não uma decisão do front-end.
 */
import type { AcaoOperacao, CaracteristicaCarga, EstadoCaminhao, TipoOperacao } from "@/types/terminal";
import type {
  AreaE,
  DocaE,
  EquipamentoE,
  EstadoTerminal,
  Funcionario,
  OperacaoE,
  PoliticaFila,
  VagaE,
} from "./tipos";

/* ---------- Máquina de estados (TRANSICOES) ---------- */

export const TRANSICOES: Record<EstadoCaminhao, readonly EstadoCaminhao[]> = {
  AGUARDANDO_DOCUMENTACAO: ["AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "AGUARDANDO_LIBERACAO"],
  AGUARDANDO_INSPECAO: ["AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_ENTRADA", "AGUARDANDO_LIBERACAO"],
  AGUARDANDO_ENTRADA: ["NO_PATIO", "AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_LIBERACAO"],
  NO_PATIO: ["AGUARDANDO_RECURSO", "AGUARDANDO_LIBERACAO"],
  AGUARDANDO_RECURSO: ["EM_OPERACAO", "AGUARDANDO_LIBERACAO"],
  EM_OPERACAO: ["AGUARDANDO_RECURSO", "AGUARDANDO_LIBERACAO"],
  AGUARDANDO_LIBERACAO: ["FINALIZADO"],
  FINALIZADO: [],
};

export const transicaoPermitida = (de: EstadoCaminhao, para: EstadoCaminhao) =>
  TRANSICOES[de].includes(para);

/** `Operacao.acoes_permitidas` (main.py). */
export const ACOES_PERMITIDAS: Record<EstadoCaminhao, readonly AcaoOperacao[]> = {
  AGUARDANDO_DOCUMENTACAO: ["documentation", "cancel"],
  AGUARDANDO_INSPECAO: ["inspection", "cancel"],
  AGUARDANDO_ENTRADA: ["yard-entry", "cancel"],
  NO_PATIO: ["start", "interrupt", "cancel"],
  AGUARDANDO_RECURSO: ["start", "interrupt", "cancel"],
  EM_OPERACAO: ["finish", "interrupt"],
  AGUARDANDO_LIBERACAO: ["release"],
  FINALIZADO: [],
};

/** Valores de `CaracteristicaCarga` (main.py), na ordem de apresentação. */
export const CARACTERISTICAS: readonly CaracteristicaCarga[] = [
  "comum",
  "prioritária",
  "perigosa",
  "refrigerada",
  "frágil",
];

/** `FabricaOperacao.criar`: estado inicial coerente com a documentação e a inspeção. */
export const estadoInicial = (documentacaoRegular: boolean, exigeInspecao: boolean): EstadoCaminhao =>
  !documentacaoRegular
    ? "AGUARDANDO_DOCUMENTACAO"
    : exigeInspecao
      ? "AGUARDANDO_INSPECAO"
      : "AGUARDANDO_ENTRADA";

/** Estados que entram na fila (`FilaAtendimento.ordenar`). */
export const ESTADOS_NA_FILA: readonly EstadoCaminhao[] = [
  "AGUARDANDO_ENTRADA",
  "NO_PATIO",
  "AGUARDANDO_RECURSO",
];

/* ---------- Política da fila (PoliticaFila + FilaAtendimento) ---------- */

/** Pesos padrão de `PoliticaFilaEntrada` (api.py). "comum" não pontua. */
export const POLITICA_PADRAO: PoliticaFila = {
  pesos: { prioritária: 100, perigosa: 50, refrigerada: 30, frágil: 20 },
  bonus_por_minuto: 0.5,
};

export const minutosEntre = (de: string | Date, ate: Date) =>
  Math.max(0, (ate.getTime() - new Date(de).getTime()) / 60_000);

/** `PoliticaFila.pontuacao`: soma dos pesos das características + minutos × bônus. */
export function pontuacao(
  politica: PoliticaFila,
  caracteristicas: readonly CaracteristicaCarga[],
  chegadaEm: string,
  agora: Date,
): number {
  const prioridade = caracteristicas.reduce((s, c) => s + (politica.pesos[c] ?? 0), 0);
  return prioridade + minutosEntre(chegadaEm, agora) * politica.bonus_por_minuto;
}

export interface ItemFilaCalculado {
  operacao: OperacaoE;
  posicao: number;
  espera_minutos: number;
  pontuacao: number;
}

/**
 * `FilaAtendimento.ordenar`: só AGUARDANDO_ENTRADA, NO_PATIO e AGUARDANDO_RECURSO;
 * maior pontuação primeiro; empate pela chegada mais antiga.
 */
export function ordenarFila(
  operacoes: readonly OperacaoE[],
  politica: PoliticaFila,
  agora: Date,
): ItemFilaCalculado[] {
  return operacoes
    .filter((o) => ESTADOS_NA_FILA.includes(o.estado))
    .map((o) => ({ o, p: pontuacao(politica, o.carga.caracteristicas, o.chegada_em, agora) }))
    .sort((a, b) => b.p - a.p || Date.parse(a.o.chegada_em) - Date.parse(b.o.chegada_em))
    .map(({ o, p }, i) => ({
      operacao: o,
      posicao: i + 1,
      espera_minutos: minutosEntre(o.chegada_em, agora),
      pontuacao: p,
    }));
}

/* ---------- Compatibilidade de recursos ---------- */

export const exige = (o: OperacaoE, c: CaracteristicaCarga) => o.carga.caracteristicas.includes(c);

export const areaDe = (e: EstadoTerminal, r: { area_id: string }): AreaE => {
  const area = e.areas.find((a) => a.id === r.area_id);
  if (!area) throw new Error(`Área ${r.area_id} inexistente (dado inconsistente).`);
  return area;
};

/**
 * Motivo pelo qual a área não serve à carga, ou `null` quando serve. Condições
 * comuns a vaga e doca (`alocar_e_iniciar` / `autorizar_entrada`). É a única
 * definição: `areaAdequada` e os textos de recusa saem dela.
 */
export function motivoAreaInadequada(area: AreaE, o: OperacaoE, exigirPerigosa = true): string | null {
  if (area.interditada) return "Área interditada";
  if (exige(o, "refrigerada") && !area.refrigerada) return "Área sem refrigeração";
  if (exige(o, "perigosa") && exigirPerigosa && !area.autorizada_carga_perigosa) {
    return "Área não autorizada para carga perigosa";
  }
  return null;
}

export const areaAdequada = (area: AreaE, o: OperacaoE, exigirPerigosa = true): boolean =>
  motivoAreaInadequada(area, o, exigirPerigosa) === null;

/**
 * Motivo pelo qual a vaga não pode receber a operação, ou `null` quando pode
 * (`autorizar_entrada` e escolha em `alocar_e_iniciar`): vaga LIVRE em área adequada.
 */
export function motivoVagaIndisponivel(e: EstadoTerminal, v: VagaE, o: OperacaoE): string | null {
  if (v.estado === "OCUPADO") return "Ocupada";
  if (v.estado === "EM_MANUTENCAO") return "Em manutenção";
  if (v.estado !== "LIVRE") return "Indisponível";
  return motivoAreaInadequada(areaDe(e, v), o);
}

/** Vaga livre e adequada à carga. */
export const vagaAdequada = (e: EstadoTerminal, v: VagaE, o: OperacaoE): boolean =>
  motivoVagaIndisponivel(e, v, o) === null;

/** Doca livre e adequada (`alocar_e_iniciar`): tipo livre ou igual ao da operação. */
export const docaAdequada = (e: EstadoTerminal, d: DocaE, o: OperacaoE) =>
  d.estado === "LIVRE" &&
  (d.tipo === null || d.tipo === o.tipo) &&
  areaAdequada(areaDe(e, d), o);

/** `Equipamento.compativel`: DISPONIVEL, tipo compatível e, se frágil, que aceite. */
export function equipamentoCompativel(eq: EquipamentoE, o: OperacaoE): boolean {
  if (eq.estado !== "DISPONIVEL" || !eq.tipos_compativeis.includes(o.tipo)) return false;
  return !exige(o, "frágil") || eq.aceita_carga_fragil;
}

/** Habilitação exigida de quem inicia a operação (`alocar_e_iniciar`). */
export const habilitacaoPara = (tipo: TipoOperacao) => (tipo === "carga" ? "carga" : "descarga");

export const habilitado = (f: Funcionario, tipo: TipoOperacao) =>
  f.habilitacoes.includes(habilitacaoPara(tipo));

export const ehSupervisao = (f: Funcionario) =>
  f.funcao === "SUPERVISOR" || f.funcao === "ADMINISTRADOR";
