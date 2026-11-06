/**
 * Carrega os dados das telas e monta o que elas compartilham (índices,
 * ligações entre ocorrências, caminhões e recursos). Só junta dados; não
 * decide prioridade, alocação nem compatibilidade.
 */
import { getTerminal, REFERENCIA_SIMULADA } from "@/services/terminal";
import type { LigacaoOcorrencia } from "@/components/terminal/details";
import type { ContextoRecursos } from "@/components/terminal/recurso-views";
import {
  ROTULO_SEVERIDADE,
  criarIndice,
  formatarDuracao,
  minutosDesde,
  nivelVisual,
  tituloOcorrencia,
} from "@/lib/terminal";
import type { OcorrenciaListada } from "@/types/terminal";

export async function carregarTerminal() {
  const t = await getTerminal();
  const idx = criarIndice(t.operacoes, t.recursos);
  const abertas = t.ocorrencias.filter((o) => o.estado === "ABERTA");
  const filaPorOperacao = new Map(t.fila.map((i) => [i.operacao_id, i]));
  const ctx: ContextoRecursos = { idx, filaPorOperacao, abertas };
  const numeroOcorrencia = (o: OcorrenciaListada) =>
    abertas.findIndex((x) => x.id === o.id) + 1;
  const idadeOcorrencia = (o: OcorrenciaListada) =>
    formatarDuracao(minutosDesde(o.criada_em, REFERENCIA_SIMULADA));
  const titulo = (o: OcorrenciaListada) => tituloOcorrencia(o, idx, t.recursos);

  /** Converte ocorrências em ligações clicáveis (só as abertas têm link). */
  const ligacoes = (
    lista: OcorrenciaListada[],
    hrefDe: (o: OcorrenciaListada) => string,
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
    idx,
    abertas,
    filaPorOperacao,
    ctx,
    numeroOcorrencia,
    idadeOcorrencia,
    titulo,
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
