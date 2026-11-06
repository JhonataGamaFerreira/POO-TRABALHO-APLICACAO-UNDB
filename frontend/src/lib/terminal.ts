/**
 * Apresentação dos dados do terminal: rótulos, formatação e junções por id.
 * Aqui NÃO há regra de negócio: não se calcula prioridade, alocação nem
 * compatibilidade. O que o backend não informa não é inferido.
 */
import type {
  CaracteristicaCarga,
  Doca,
  Equipamento,
  EstadoCaminhao,
  EstadoRecurso,
  ImpactoOcorrencia,
  OcorrenciaListada,
  Operacao,
  Recursos,
  SeveridadeOcorrencia,
  TipoOcorrencia,
  Vaga,
} from "@/types/terminal";

/* ---------- Etapas do fluxo (8 estados do caminhão) ---------- */

export const ETAPAS: ReadonlyArray<{
  estado: EstadoCaminhao;
  curto: string;
  longo: string;
}> = [
  { estado: "AGUARDANDO_DOCUMENTACAO", curto: "Documentação", longo: "Aguardando documentação" },
  { estado: "AGUARDANDO_INSPECAO", curto: "Inspeção", longo: "Aguardando inspeção" },
  { estado: "AGUARDANDO_ENTRADA", curto: "Entrada", longo: "Aguardando entrada" },
  { estado: "NO_PATIO", curto: "No pátio", longo: "No pátio" },
  { estado: "AGUARDANDO_RECURSO", curto: "Aguard. recurso", longo: "Aguardando recurso" },
  { estado: "EM_OPERACAO", curto: "Em operação", longo: "Em operação" },
  { estado: "AGUARDANDO_LIBERACAO", curto: "Aguard. liberação", longo: "Aguardando liberação" },
  { estado: "FINALIZADO", curto: "Finalizado", longo: "Finalizado" },
];

export const etapaLonga = (e: EstadoCaminhao) =>
  ETAPAS.find((x) => x.estado === e)?.longo ?? e;

/* ---------- Recursos ---------- */

export type TipoRecurso = "vaga" | "doca" | "equipment";

export function rotuloEstadoRecurso(
  estado: EstadoRecurso,
  tipo: TipoRecurso,
): string {
  if (estado === "LIVRE") return "Livre";
  if (estado === "DISPONIVEL") return "Disponível";
  if (estado === "EM_MANUTENCAO") return "Em manutenção";
  return tipo === "equipment" ? "Em uso" : "Ocupada";
}

/* ---------- Ocorrências ---------- */

export const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  EQUIPAMENTO_QUEBRADO: "Equipamento quebrado",
  DOCUMENTACAO_IRREGULAR: "Documentação irregular",
  CARGA_DIVERGENTE: "Carga divergente",
  ACIDENTE: "Acidente",
  AREA_INTERDITADA: "Área interditada",
  ATRASO: "Atraso",
  CANCELAMENTO: "Cancelamento",
};

export const ROTULO_IMPACTO: Record<ImpactoOcorrencia, string> = {
  operacao: "Operação",
  recurso: "Recurso",
  seguranca: "Segurança",
  ambiental: "Ambiental",
  outro: "Outro",
};

export const ROTULO_SEVERIDADE: Record<SeveridadeOcorrencia, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export type NivelVisual = "critical" | "attention" | "none";

/**
 * PROPOSTA (não aprovada): o Figma só tem dois níveis visuais (Crítico e
 * Atenção) e o backend tem quatro severidades. Este é o único ponto do código
 * que faz essa correspondência. O texto exibido sempre é a severidade real.
 */
export function nivelVisual(s: SeveridadeOcorrencia): NivelVisual {
  if (s === "critica") return "critical";
  if (s === "alta" || s === "media") return "attention";
  return "none";
}

export function rotuloCaracteristica(c: CaracteristicaCarga): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export const resumoCarga = (carga: { descricao: string; caracteristicas: CaracteristicaCarga[] }) =>
  carga.caracteristicas.map(rotuloCaracteristica).join(", ");

/* ---------- Tempo ---------- */

/** 38 → "38 min"; 112 → "1h52". */
export function formatarDuracao(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h}h${String(r).padStart(2, "0")}`;
}

const horaFormatador = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const dataHoraFormatador = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
export const formatarHora = (iso: string) => horaFormatador.format(new Date(iso));
export const formatarDataHora = (iso: string) => dataHoraFormatador.format(new Date(iso));

/* ---------- Índices e junções por id ---------- */

export interface Indice {
  operacaoPorId: Map<string, Operacao>;
  operacaoPorPlaca: Map<string, Operacao>;
  vagaPorId: Map<string, Vaga>;
  docaPorId: Map<string, Doca>;
  equipPorId: Map<string, Equipamento>;
  /**
   * Códigos de exibição. O backend só envia UUID para vaga e doca, então
   * V01/D1 seguem a ORDEM da lista da API (convenção de apresentação).
   * Equipamento usa o `nome` do backend.
   */
  codigoVaga: Map<string, string>;
  codigoDoca: Map<string, string>;
}

export function criarIndice(operacoes: Operacao[], recursos: Recursos): Indice {
  return {
    operacaoPorId: new Map(operacoes.map((o) => [o.id, o])),
    operacaoPorPlaca: new Map(operacoes.map((o) => [o.caminhao.placa, o])),
    vagaPorId: new Map(recursos.vagas.map((v) => [v.id, v])),
    docaPorId: new Map(recursos.docas.map((d) => [d.id, d])),
    equipPorId: new Map(recursos.equipamentos.map((e) => [e.id, e])),
    codigoVaga: new Map(
      recursos.vagas.map((v, i) => [v.id, `V${String(i + 1).padStart(2, "0")}`]),
    ),
    codigoDoca: new Map(recursos.docas.map((d, i) => [d.id, `D${i + 1}`])),
  };
}

export interface RecursoResolvido {
  tipo: "area" | "vaga" | "doca" | "equipment";
  id: string;
  codigo: string;
}

/** Resolve `recurso_tipo` + `recurso_id` de uma ocorrência. */
export function resolverRecurso(
  o: Pick<OcorrenciaListada, "recurso_tipo" | "recurso_id">,
  indice: Indice,
  areas: Recursos,
): RecursoResolvido | null {
  if (!o.recurso_tipo || !o.recurso_id) return null;
  const id = o.recurso_id;
  if (o.recurso_tipo === "vaga") return { tipo: "vaga", id, codigo: indice.codigoVaga.get(id) ?? "Vaga" };
  if (o.recurso_tipo === "doca") return { tipo: "doca", id, codigo: indice.codigoDoca.get(id) ?? "Doca" };
  if (o.recurso_tipo === "equipment") {
    return { tipo: "equipment", id, codigo: indice.equipPorId.get(id)?.nome ?? "Equipamento" };
  }
  const area = [...areas.vagas, ...areas.docas].find((r) => r.area.id === id)?.area;
  return { tipo: "area", id, codigo: area?.nome ?? "Área" };
}

/**
 * O backend não envia título nem numeração. O título é montado a partir de
 * campos reais (tipo + recurso ou placa) e o número segue a ordem da lista.
 */
export function tituloOcorrencia(
  o: OcorrenciaListada,
  indice: Indice,
  recursos: Recursos,
): string {
  const tipo = ROTULO_TIPO_OCORRENCIA[o.tipo];
  const recurso = resolverRecurso(o, indice, recursos);
  const placa = indice.operacaoPorId.get(o.operacao_id)?.caminhao.placa;
  const alvo = recurso?.codigo ?? placa;
  return alvo ? `${tipo} · ${alvo}` : tipo;
}

/** Placa/vaga/doca/equipamento associados a uma operação (só o que a API traz). */
export function recursosDaOperacao(op: Operacao, indice: Indice) {
  return {
    vaga: op.vaga ? indice.codigoVaga.get(op.vaga.id) ?? null : null,
    doca: op.doca ? indice.codigoDoca.get(op.doca.id) ?? null : null,
    equipamento: op.equipamento?.nome ?? null,
  };
}

/* ---------- Auxiliares de tela ---------- */

/** Minutos entre um instante e a referência (relógio real ou instante dos mocks). */
export function minutosDesde(iso: string, referenciaIso: string): number {
  return Math.max(0, (Date.parse(referenciaIso) - Date.parse(iso)) / 60_000);
}

const ORDEM_SEVERIDADE: SeveridadeOcorrencia[] = ["baixa", "media", "alta", "critica"];

/** Maior severidade entre as ocorrências abertas (ou null). Só compara; não classifica. */
export function maiorSeveridade(
  ocorrencias: Array<{ severidade: SeveridadeOcorrencia; estado: string }>,
): SeveridadeOcorrencia | null {
  const abertas = ocorrencias.filter((o) => o.estado === "ABERTA");
  if (!abertas.length) return null;
  return abertas.reduce((m, o) =>
    ORDEM_SEVERIDADE.indexOf(o.severidade) > ORDEM_SEVERIDADE.indexOf(m.severidade) ? o : m,
  ).severidade;
}

/** Valor da query string como texto único. */
export function parametro(
  sp: Record<string, string | string[] | undefined>,
  chave: string,
): string | undefined {
  const v = sp[chave];
  return Array.isArray(v) ? v[0] : v;
}
