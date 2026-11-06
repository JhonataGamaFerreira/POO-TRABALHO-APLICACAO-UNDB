/**
 * Carrega os dados das telas e monta o que elas compartilham (índices,
 * ligações entre ocorrências, caminhões e recursos). Só junta dados; não
 * decide prioridade, alocação nem compatibilidade.
 *
 * Os campos da PROPOSTA de contrato (src/types/terminal-proposto.ts) são lidos
 * com fallback para a API atual: sem eles a tela continua funcionando, só com
 * menos informação.
 */
import { getTerminal, REFERENCIA_SIMULADA } from "@/services/terminal";
import type { LigacaoOcorrencia } from "@/components/terminal/details";
import type { ContextoRecursos } from "@/components/terminal/recurso-views";
import {
  ETAPAS,
  ROTULO_SEVERIDADE,
  criarIndice,
  etapaLonga,
  formatarDuracao,
  minutosDesde,
  nivelVisual,
  rotuloEspeciais,
  tituloOcorrencia,
} from "@/lib/terminal";
import type { Operacao, SeveridadeOcorrencia } from "@/types/terminal";
import type {
  EtapaFluxo,
  OcorrenciaProposta,
  OperacaoAfetada,
} from "@/types/terminal-proposto";

const ORDEM_SEVERIDADE: SeveridadeOcorrencia[] = ["baixa", "media", "alta", "critica"];
const maior = (a: SeveridadeOcorrencia, b: SeveridadeOcorrencia) =>
  ORDEM_SEVERIDADE.indexOf(a) >= ORDEM_SEVERIDADE.indexOf(b) ? a : b;

/** "A", "A e B", "A, B e C". */
export const juntar = (itens: string[]) =>
  itens.length < 2 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;

export async function carregarTerminal() {
  const t = await getTerminal();
  const idx = criarIndice(t.operacoes, t.recursos);
  const abertas = t.ocorrencias.filter((o) => o.estado === "ABERTA");
  const filaPorOperacao = new Map(t.fila.map((i) => [i.operacao_id, i]));
  const compatPorOperacao = new Map(t.compativeis.map((c) => [c.operacao_id, c]));

  /** Operações afetadas (PROPOSTA); sem o campo, só a operação de origem. */
  const afetadasDe = (o: OcorrenciaProposta): OperacaoAfetada[] =>
    o.operacoes_afetadas ?? [{ operacao_id: o.operacao_id, severidade: o.severidade }];

  /** Maior severidade de impacto sobre cada operação, entre as ocorrências abertas. */
  const sevPorOperacao = new Map<string, SeveridadeOcorrencia>();
  for (const o of abertas) {
    for (const a of afetadasDe(o)) {
      const atual = sevPorOperacao.get(a.operacao_id);
      sevPorOperacao.set(a.operacao_id, atual ? maior(atual, a.severidade) : a.severidade);
    }
  }

  /**
   * Etapas do fluxo. Usa `etapas` (PROPOSTA); sem ele, monta a partir de
   * `por_estado` + média por etapa da API atual, sempre na faixa "normal".
   */
  const etapas: EtapaFluxo[] =
    t.dashboard.etapas ??
    ETAPAS.map((e) => ({
      estado: e.estado,
      quantidade: t.dashboard.por_estado[e.estado],
      media_minutos: t.tempos.media_por_etapa_minutos[e.estado] ?? null,
      faixa_espera: "normal" as const,
    }));
  /** Caminhões ativos = todos que não estão finalizados. */
  const ativos = t.dashboard.total_operacoes - t.dashboard.por_estado.FINALIZADO;
  const finalizadosHoje = t.dashboard.finalizados_hoje ?? t.dashboard.por_estado.FINALIZADO;

  const ctx: ContextoRecursos = {
    idx,
    filaPorOperacao,
    abertas,
    sevPorOperacao,
    afetadasDe,
    agora: REFERENCIA_SIMULADA,
  };
  const numeroOcorrencia = (o: OcorrenciaProposta) =>
    abertas.findIndex((x) => x.id === o.id) + 1;
  const idadeOcorrencia = (o: OcorrenciaProposta) =>
    formatarDuracao(minutosDesde(o.criada_em, REFERENCIA_SIMULADA));
  const titulo = (o: OcorrenciaProposta) => tituloOcorrencia(o, idx, t.recursos);

  /** Métrica da linha: a definida pelo back-end (PROPOSTA) ou, sem ela, "aberta há". */
  const metrica = (o: OcorrenciaProposta) =>
    o.metrica_impacto
      ? { valor: formatarDuracao(o.metrica_impacto.minutos), legenda: o.metrica_impacto.rotulo }
      : { valor: idadeOcorrencia(o), legenda: "aberta há" };

  /** Operações (já resolvidas) afetadas por uma ocorrência. */
  const operacoesAfetadas = (o: OcorrenciaProposta) =>
    afetadasDe(o)
      .map((a) => ({ ...a, op: idx.operacaoPorId.get(a.operacao_id) }))
      .filter((a): a is OperacaoAfetada & { op: Operacao } => !!a.op);

  /**
   * Texto de uma linha para a lista. Com mais de uma operação afetada resume
   * os caminhões ("Afeta A e B, ambos aguardando recurso"); com uma, vale a descrição da ocorrência.
   */
  const descricaoLinha = (o: OcorrenciaProposta) => {
    const afetadas = operacoesAfetadas(o);
    if (afetadas.length < 2) return o.descricao;
    const nomes = afetadas.map(({ op }) => {
      const especiais = rotuloEspeciais(op.carga.caracteristicas).toLowerCase().replaceAll(" · ", ", ");
      return especiais ? `${op.caminhao.placa} (${especiais})` : op.caminhao.placa;
    });
    const etapas = new Set(afetadas.map(({ op }) => op.estado));
    const etapa = etapas.size === 1 ? etapaLonga(afetadas[0].op.estado).toLowerCase() : null;
    return `Afeta ${juntar(nomes)}${etapa ? `, ambos ${etapa}` : ""}`;
  };

  /** Ocorrências ligadas a uma operação (origem ou afetada). */
  const ocorrenciasDaOperacao = (operacaoId: string) =>
    t.ocorrencias.filter((o) =>
      afetadasDe(o).some((a) => a.operacao_id === operacaoId),
    );

  /** Converte ocorrências em ligações clicáveis (só as abertas têm link). */
  const ligacoes = (
    lista: OcorrenciaProposta[],
    hrefDe: (o: OcorrenciaProposta) => string,
  ): LigacaoOcorrencia[] =>
    lista.map((o) => ({
      id: o.id,
      titulo: titulo(o),
      nivel: nivelVisual(o.severidade),
      rotuloSeveridade: ROTULO_SEVERIDADE[o.severidade],
      estado: o.estado,
      href: o.estado === "ABERTA" ? hrefDe(o) : undefined,
    }));

  return {
    ...t,
    etapas,
    ativos,
    finalizadosHoje,
    idx,
    abertas,
    filaPorOperacao,
    compatPorOperacao,
    ctx,
    numeroOcorrencia,
    idadeOcorrencia,
    titulo,
    metrica,
    descricaoLinha,
    afetadasDe,
    operacoesAfetadas,
    ocorrenciasDaOperacao,
    ligacoes,
  };
}

export type TerminalCarregado = Awaited<ReturnType<typeof carregarTerminal>>;

/** Monta `base?a=1&b=2` ignorando parâmetros vazios. */
export function montarHref(
  base: string,
  params: Record<string, string | undefined | null>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
