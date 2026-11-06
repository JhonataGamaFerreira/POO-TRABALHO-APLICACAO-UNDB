/**
 * Camada de acesso aos dados do terminal.
 *
 * HOJE: devolve os mocks de src/mocks (dados simulados, sem integração).
 * DEPOIS: cada função aponta para o endpoint indicado, com a mesma assinatura
 * e os mesmos tipos de src/types/terminal.ts. As telas só dependem daqui.
 */
import {
  MOCK_AGORA,
  MOCK_FILA,
  MOCK_OCORRENCIAS,
  MOCK_OPERACOES,
  MOCK_RECURSOS,
  MOCK_TEMPOS,
  montarDashboardMock,
} from "@/mocks/terminal";
import type {
  DashboardResumo,
  EstadoOcorrencia,
  ItemFila,
  OcorrenciaListada,
  Operacao,
  RelatorioTempos,
  Recursos,
} from "@/types/terminal";

/** Verdadeiro enquanto a fonte for src/mocks. Usado para avisar na interface. */
export const USANDO_DADOS_SIMULADOS = true;

/** Instante de referência dos mocks (não é o relógio real). */
export const REFERENCIA_SIMULADA = MOCK_AGORA;

/** GET /api/dashboard */
export async function getDashboard(): Promise<DashboardResumo> {
  return montarDashboardMock();
}

/** GET /api/operations */
export async function getOperacoes(): Promise<Operacao[]> {
  return MOCK_OPERACOES;
}

/** GET /api/queue (ordem e pontuação definidas pelo backend) */
export async function getFila(): Promise<ItemFila[]> {
  return MOCK_FILA;
}

/** GET /api/occurrences[?estado=ABERTA|RESOLVIDA] */
export async function getOcorrencias(
  estado?: EstadoOcorrencia,
): Promise<OcorrenciaListada[]> {
  return estado
    ? MOCK_OCORRENCIAS.filter((o) => o.estado === estado)
    : MOCK_OCORRENCIAS;
}

/** GET /api/resources */
export async function getRecursos(): Promise<Recursos> {
  return MOCK_RECURSOS;
}

/** GET /api/reports/timings */
export async function getRelatorioTempos(): Promise<RelatorioTempos> {
  return MOCK_TEMPOS;
}

/** Reúne o que as três telas precisam numa única chamada. */
export async function getTerminal() {
  const [dashboard, operacoes, fila, ocorrencias, recursos, tempos] =
    await Promise.all([
      getDashboard(),
      getOperacoes(),
      getFila(),
      getOcorrencias(),
      getRecursos(),
      getRelatorioTempos(),
    ]);
  return { dashboard, operacoes, fila, ocorrencias, recursos, tempos };
}

export type Terminal = Awaited<ReturnType<typeof getTerminal>>;
