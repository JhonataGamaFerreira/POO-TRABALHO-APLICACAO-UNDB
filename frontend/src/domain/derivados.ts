/**
 * Valores derivados do estado (nunca persistidos): tempos, fila com fatores,
 * contagens do painel, motivo de espera, restrição de doca, docas compatíveis
 * e métrica das ocorrências.
 *
 * ORIGEM:
 *  - `temposMinutos`, `fatoresDaFila`, `filaDe`: fórmulas de `api.py`/`main.py`.
 *  - `motivoEspera`, `restricaoDoca`, `docasCompativeis`, `metricaOcorrencia`:
 *    HIPÓTESE DE APRESENTAÇÃO (a PROPOSTA de contrato pede esses textos ao
 *    backend). Só descrevem fatos do estado atual (qual recurso está ocupado,
 *    em manutenção etc.); não decidem alocação nem prioridade.
 */
import type {
  CaracteristicaCarga,
  DashboardResumo,
  EstadoCaminhao,
  EstadoRecurso,
  FatorFila,
  ItemFila,
} from "@/types/terminal";
import type { DocasCompativeis, RotuloMetricaImpacto } from "@/types/terminal-proposto";
import {
  ACOES_PERMITIDAS,
  areaAdequada,
  areaDe,
  equipamentoCompativel,
  minutosEntre,
  motivoVagaIndisponivel,
  ordenarFila,
} from "./regras";
import type { DocaE, EstadoTerminal, OcorrenciaE, OperacaoE } from "./tipos";
import { normalizarPlaca } from "./validacao";

/** "A", "A e B", "A, B e C". */
export const juntar = (itens: string[]) =>
  itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;

export const ESTADOS_ORDEM: readonly EstadoCaminhao[] = [
  "AGUARDANDO_DOCUMENTACAO",
  "AGUARDANDO_INSPECAO",
  "AGUARDANDO_ENTRADA",
  "NO_PATIO",
  "AGUARDANDO_RECURSO",
  "EM_OPERACAO",
  "AGUARDANDO_LIBERACAO",
  "FINALIZADO",
];

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** `tempos_minutos` de `api.py`: espera até iniciar (ou agora); operação até finalizar (ou agora). */
export function temposMinutos(op: OperacaoE, agora: Date) {
  const fimEspera = op.iniciada_em ? new Date(op.iniciada_em) : agora;
  const fimOperacao = op.finalizada_em ? new Date(op.finalizada_em) : agora;
  return {
    espera: arredondar(minutosEntre(op.chegada_em, fimEspera)),
    operacao: op.iniciada_em ? arredondar(minutosEntre(op.iniciada_em, fimOperacao)) : 0,
  };
}

export const acoesPermitidas = (op: OperacaoE) => [...ACOES_PERMITIDAS[op.estado]];

/* ---------- Fila ---------- */

/** Fatores como em `FilaAtendimento.ordenar`: uma linha por característica (ordem alfabética) + espera. */
export function fatoresDaFila(e: EstadoTerminal, op: OperacaoE, esperaMinutos: number): FatorFila[] {
  const caracteristicas = [...op.carga.caracteristicas].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return [
    ...caracteristicas.map(
      (c: CaracteristicaCarga): FatorFila => ({
        tipo: "caracteristica",
        caracteristica: c,
        peso: e.politica.pesos[c] ?? 0,
      }),
    ),
    {
      tipo: "tempo_espera",
      minutos: esperaMinutos,
      bonus_por_minuto: e.politica.bonus_por_minuto,
      pontos: esperaMinutos * e.politica.bonus_por_minuto,
    },
  ];
}

export function filaDe(e: EstadoTerminal, agora: Date): Array<ItemFila & { motivo_espera: string | null }> {
  return ordenarFila(e.operacoes, e.politica, agora).map(({ operacao: op, posicao, espera_minutos, pontuacao }) => ({
    operacao_id: op.id,
    placa: op.caminhao.placa,
    carga: op.carga,
    estado: op.estado,
    posicao,
    espera_minutos,
    pontuacao,
    fatores: fatoresDaFila(e, op, espera_minutos),
    motivo_espera: motivoEspera(e, op),
  }));
}

/* ---------- Entrada no pátio ---------- */

/** Vaga como candidata à entrada de uma operação, com o motivo quando não serve. */
export interface OpcaoVaga {
  vaga_id: string;
  codigo: string;
  area: string;
  disponivel: boolean;
  /** Preenchido só quando `disponivel` é false (mesma regra de `autorizar_entrada`). */
  motivo: string | null;
}

/** Todas as vagas, por código, marcando quais podem receber a operação agora. */
export function vagasParaEntrada(e: EstadoTerminal, op: OperacaoE): OpcaoVaga[] {
  return e.vagas
    .map((v) => {
      const motivo = motivoVagaIndisponivel(e, v, op);
      return { vaga_id: v.id, codigo: v.codigo, area: areaDe(e, v).nome, disponivel: motivo === null, motivo };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}

/** Caminhão já cadastrado para a placa (qualquer grafia), ou `null`. */
export function caminhaoPorPlaca(e: EstadoTerminal, placa: string) {
  const alvo = normalizarPlaca(placa);
  return e.operacoes.find((o) => o.caminhao.placa === alvo)?.caminhao ?? null;
}

/* ---------- Painel ---------- */

const contarRecursos = (itens: Array<{ estado: EstadoRecurso }>): Record<EstadoRecurso, number> => ({
  LIVRE: itens.filter((i) => i.estado === "LIVRE").length,
  DISPONIVEL: itens.filter((i) => i.estado === "DISPONIVEL").length,
  OCUPADO: itens.filter((i) => i.estado === "OCUPADO").length,
  EM_MANUTENCAO: itens.filter((i) => i.estado === "EM_MANUTENCAO").length,
});

/** `GET /api/dashboard`: contagens por estado da operação e por estado de recurso. */
export function resumoDoPainel(e: EstadoTerminal): DashboardResumo {
  const por_estado = Object.fromEntries(
    ESTADOS_ORDEM.map((s) => [s, e.operacoes.filter((o) => o.estado === s).length]),
  ) as DashboardResumo["por_estado"];
  return {
    total_operacoes: e.operacoes.length,
    por_estado,
    recursos: {
      vagas: contarRecursos(e.vagas),
      docas: contarRecursos(e.docas),
      equipamentos: contarRecursos(e.equipamentos),
    },
  };
}

/* ---------- Textos explicativos (apresentação) ---------- */

const equipamentoQuebrado = (e: EstadoTerminal, equipId: string) =>
  e.ocorrencias.some(
    (o) =>
      o.estado === "ABERTA" &&
      o.tipo === "EQUIPAMENTO_QUEBRADO" &&
      o.recurso_tipo === "equipment" &&
      o.recurso_id === equipId,
  );

/** Docas que, pelas regras de área e tipo, poderiam receber a carga (ignora ocupação). */
const docasPossiveis = (e: EstadoTerminal, op: OperacaoE) =>
  e.docas.filter(
    (d) => (d.tipo === null || d.tipo === op.tipo) && areaAdequada(areaDe(e, d), op),
  );

const equipamentosPossiveis = (e: EstadoTerminal, op: OperacaoE) =>
  e.equipamentos.filter((q) =>
    equipamentoCompativel({ ...q, estado: "DISPONIVEL" }, op),
  );

/**
 * Por que o caminhão ainda não iniciou. Só descreve o estado atual dos recursos;
 * `null` quando nada impede (ele pode ser iniciado) ou quando a etapa não espera recurso.
 */
export function motivoEspera(e: EstadoTerminal, op: OperacaoE): string | null {
  if (op.estado !== "NO_PATIO" && op.estado !== "AGUARDANDO_RECURSO") return null;

  if (op.interrupcao) {
    const doca = e.docas.find((d) => d.id === op.interrupcao!.doca_id);
    return doca ? `Operação interrompida na ${doca.codigo}` : "Operação interrompida";
  }

  const possiveis = docasPossiveis(e, op);
  const livres = possiveis.filter((d) => d.estado === "LIVRE");
  const tipoDoca = op.carga.caracteristicas.includes("refrigerada")
    ? "doca refrigerada"
    : op.carga.caracteristicas.includes("perigosa")
      ? "doca para carga perigosa"
      : "doca";

  if (!livres.length) {
    if (!possiveis.length) return `Nenhuma ${tipoDoca} compatível`;
    const ocupadas = possiveis.filter((d) => d.estado === "OCUPADO");
    const manutencao = possiveis.filter((d) => d.estado === "EM_MANUTENCAO");
    const partes: string[] = [];
    if (ocupadas.length) {
      partes.push(
        ocupadas.length <= 2
          ? `${juntar(ocupadas.map((d) => d.codigo))} ${ocupadas.length > 1 ? "ocupadas" : "ocupada"}`
          : `${ocupadas.length} ocupadas`,
      );
    }
    if (manutencao.length) partes.push(`${juntar(manutencao.map((d) => d.codigo))} em manutenção`);
    return `Sem ${tipoDoca} livre${partes.length ? `; ${partes.join(", ")}` : ""}`;
  }

  const compativeis = equipamentosPossiveis(e, op);
  if (!compativeis.some((q) => q.estado === "DISPONIVEL")) {
    const fora = compativeis.filter((q) => q.estado === "EM_MANUTENCAO");
    if (fora.length) {
      const quebrados = fora.every((q) => equipamentoQuebrado(e, q.id));
      const nomes = juntar(fora.map((q) => q.nome));
      const situacao = quebrados ? (fora.length > 1 ? "quebrados" : "quebrado") : "em manutenção";
      return `Aguarda ${nomes} (${situacao})`;
    }
    return "Aguarda equipamento compatível";
  }
  return null;
}

/** Texto de "Por que não recebe?" para doca livre sem equipamento compatível disponível. */
export function restricaoDoca(
  e: EstadoTerminal,
  doca: DocaE,
): { codigo: "SEM_EQUIPAMENTO_COMPATIVEL"; texto: string; ocorrencia_id: string | null } | null {
  if (doca.estado !== "LIVRE" || areaDe(e, doca).interditada) return null;
  if (e.equipamentos.some((q) => q.estado === "DISPONIVEL")) return null;

  const fora = e.equipamentos.filter((q) => q.estado === "EM_MANUTENCAO");
  const emUso = e.equipamentos.filter((q) => q.estado === "OCUPADO");
  const partes: string[] = [];
  if (fora.length) {
    const quebrados = fora.every((q) => equipamentoQuebrado(e, q.id));
    const situacao = quebrados ? (fora.length > 1 ? "quebrados" : "quebrado") : "em manutenção";
    partes.push(`${juntar(fora.map((q) => q.nome))} ${fora.length > 1 ? "estão" : "está"} ${situacao}.`);
  }
  if (emUso.length) {
    const codigos = emUso
      .map((q) => e.docas.find((d) => d.id === e.operacoes.find((o) => o.equipamento_id === q.id)?.doca_id)?.codigo)
      .filter((c): c is string => !!c)
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    partes.push(
      `${juntar(emUso.map((q) => q.nome))} ${emUso.length > 1 ? "estão" : "está"} em uso${
        codigos.length ? ` nas docas ${juntar(codigos)}` : ""
      }.`,
    );
  }
  if (!partes.length) return null;
  const quebrada = e.ocorrencias.find(
    (o) => o.estado === "ABERTA" && o.tipo === "EQUIPAMENTO_QUEBRADO" && fora.some((q) => q.id === o.recurso_id),
  );
  return {
    codigo: "SEM_EQUIPAMENTO_COMPATIVEL",
    texto: partes.join(" "),
    ocorrencia_id: quebrada?.id ?? null,
  };
}

/** Interrupção pendente de uma doca: doca LIVRE de onde uma operação aguardando recurso foi interrompida. */
export function interrupcaoDaDoca(e: EstadoTerminal, doca: DocaE) {
  if (doca.estado !== "LIVRE") return null;
  const op = e.operacoes.find(
    (o) => o.estado === "AGUARDANDO_RECURSO" && o.interrupcao?.doca_id === doca.id,
  );
  if (!op?.interrupcao) return null;
  return {
    operacao_id: op.id,
    interrompida_em: op.interrupcao.interrompida_em,
    minutos_operados: op.interrupcao.minutos_operados,
    ocorrencia_id: op.interrupcao.ocorrencia_id,
  };
}

/** Consulta contextual: docas compatíveis com a carga (fora de manutenção/interdição) e a situação de cada uma. */
export function docasCompativeis(e: EstadoTerminal, op: OperacaoE): DocasCompativeis {
  const semEquipamento = !equipamentosPossiveis(e, op).some((q) => q.estado === "DISPONIVEL");
  return {
    operacao_id: op.id,
    docas: docasPossiveis(e, op)
      .filter((d) => d.estado !== "EM_MANUTENCAO")
      .map((d) => {
        if (d.estado === "OCUPADO") {
          const ocupante = e.operacoes.find((o) => o.id === d.operacao_id);
          return { doca_id: d.id, situacao: `${ocupante?.caminhao.placa ?? "—"} em operação`, disponivel: false };
        }
        if (interrupcaoDaDoca(e, d)) {
          return { doca_id: d.id, situacao: "Livre · operação interrompida", disponivel: false };
        }
        if (semEquipamento) {
          return { doca_id: d.id, situacao: "Livre · sem equipamento compatível livre", disponivel: false };
        }
        return { doca_id: d.id, situacao: "Livre", disponivel: true };
      }),
  };
}

/* ---------- Ocorrências ---------- */

const ORDEM_SEVERIDADE = ["baixa", "media", "alta", "critica"] as const;

/** Ordem de impacto (HIPÓTESE): severidade maior primeiro; empate pela mais antiga. */
export function ordenarOcorrencias(lista: readonly OcorrenciaE[]): OcorrenciaE[] {
  return [...lista].sort(
    (a, b) =>
      ORDEM_SEVERIDADE.indexOf(b.severidade) - ORDEM_SEVERIDADE.indexOf(a.severidade) ||
      Date.parse(a.criada_em) - Date.parse(b.criada_em),
  );
}

/** Instante em que a operação entrou na etapa atual. */
export function etapaDesdeOperacao(op: OperacaoE): string {
  const mudancas = op.historico.filter((h) => h.tipo === "MUDANCA_ESTADO");
  return mudancas.length
    ? mudancas.reduce((a, b) => (a.ocorrido_em > b.ocorrido_em ? a : b)).ocorrido_em
    : op.chegada_em;
}

/** Métrica de impacto da lista; `null` para ocorrência resolvida ou sem rótulo. */
export function metricaOcorrencia(
  e: EstadoTerminal,
  oc: OcorrenciaE,
  agora: Date,
): { minutos: number; rotulo: RotuloMetricaImpacto } | null {
  if (oc.estado !== "ABERTA" || !oc.metrica_rotulo) return null;
  const afetadas = (oc.operacoes_afetadas ?? [{ operacao_id: oc.operacao_id }])
    .map((a) => e.operacoes.find((o) => o.id === a.operacao_id))
    .filter((o): o is OperacaoE => !!o);
  if (oc.metrica_rotulo === "espera máxima") {
    const max = Math.max(0, ...afetadas.map((o) => minutosEntre(o.chegada_em, agora)));
    return { minutos: max, rotulo: "espera máxima" };
  }
  if (oc.metrica_rotulo === "parada") return { minutos: minutosEntre(oc.criada_em, agora), rotulo: "parada" };
  const op = afetadas[0];
  return { minutos: op ? minutosEntre(etapaDesdeOperacao(op), agora) : 0, rotulo: "na etapa" };
}
