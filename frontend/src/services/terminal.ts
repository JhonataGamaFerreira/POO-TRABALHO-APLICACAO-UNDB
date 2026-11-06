/**
 * Camada de acesso aos dados do terminal.
 *
 * HOJE: devolve os mocks de src/mocks (dados simulados, sem integração).
 * DEPOIS: cada função aponta para o endpoint indicado, com a mesma assinatura
 * e os mesmos tipos. As telas só dependem daqui.
 *
 * Os tipos retornados são os da PROPOSTA de contrato (terminal-proposto.ts):
 * superconjuntos dos tipos da API atual. Enquanto o back-end não enviar os
 * campos propostos, o front-end deve tolerar a ausência deles (ver
 * docs/contrato-api-proposto.md, seção "Compatibilidade com a API atual").
 */
import {
  MOCK_AGORA,
  MOCK_DOCAS_COMPATIVEIS,
  MOCK_FILA,
  MOCK_OCORRENCIAS,
  MOCK_OPERACOES,
  MOCK_RECURSOS,
  MOCK_TEMPOS,
  montarDashboardMock,
} from "@/mocks/terminal";
import type { EstadoOcorrencia, RelatorioTempos } from "@/types/terminal";
import type {
  DashboardProposto,
  DocasCompativeis,
  ItemFilaProposto,
  OcorrenciaProposta,
  OperacaoProposta,
  RecursosProposta,
} from "@/types/terminal-proposto";

/** Verdadeiro enquanto a fonte for src/mocks. Usado para avisar na interface. */
export const USANDO_DADOS_SIMULADOS = true;

/** Instante de referência dos mocks (não é o relógio real). */
export const REFERENCIA_SIMULADA = MOCK_AGORA;

/** GET /api/dashboard (+ `etapas` e `finalizados_hoje`: PROPOSTA) */
export async function getDashboard(): Promise<DashboardProposto> {
  return montarDashboardMock();
}

/** GET /api/operations (+ `duracao_estimada_minutos`: PROPOSTA) */
export async function getOperacoes(): Promise<OperacaoProposta[]> {
  return MOCK_OPERACOES;
}

/** GET /api/queue (ordem e pontuação definidas pelo backend; + `motivo_espera`: PROPOSTA) */
export async function getFila(): Promise<ItemFilaProposto[]> {
  return MOCK_FILA;
}

/** GET /api/occurrences[?estado=ABERTA|RESOLVIDA] (+ `titulo`, `operacoes_afetadas`, `metrica_impacto`: PROPOSTA) */
export async function getOcorrencias(
  estado?: EstadoOcorrencia,
): Promise<OcorrenciaProposta[]> {
  return estado
    ? MOCK_OCORRENCIAS.filter((o) => o.estado === estado)
    : MOCK_OCORRENCIAS;
}

/** GET /api/resources (+ `codigo`, `manutencao_ate`, `interrupcao`, `restricao`, `motivo_interdicao`: PROPOSTA) */
export async function getRecursos(): Promise<RecursosProposta> {
  return MOCK_RECURSOS;
}

/** GET /api/reports/timings */
export async function getRelatorioTempos(): Promise<RelatorioTempos> {
  return MOCK_TEMPOS;
}

/** GET /api/operations/{id}/compatible-docks — endpoint NOVO, PROPOSTA. */
export async function getDocasCompativeis(): Promise<DocasCompativeis[]> {
  return MOCK_DOCAS_COMPATIVEIS;
}

/** Reúne o que as três telas precisam numa única chamada. */
export async function getTerminal() {
  const [dashboard, operacoes, fila, ocorrencias, recursos, tempos, compativeis] =
    await Promise.all([
      getDashboard(),
      getOperacoes(),
      getFila(),
      getOcorrencias(),
      getRecursos(),
      getRelatorioTempos(),
      getDocasCompativeis(),
    ]);
  return { dashboard, operacoes, fila, ocorrencias, recursos, tempos, compativeis };
}

export type Terminal = Awaited<ReturnType<typeof getTerminal>>;
