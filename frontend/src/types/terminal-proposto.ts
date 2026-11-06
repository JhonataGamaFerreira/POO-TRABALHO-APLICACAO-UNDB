/**
 * PROPOSTA DE CONTRATO FUTURO — NÃO EXISTE NA API ATUAL (backend, commit b16a874).
 *
 * Tudo o que está neste arquivo foi acrescentado para que os mocks alimentem as
 * telas aprovadas no Figma (wireframes A1, A2, B1, B2 e B3). São campos que o
 * design precisa e que o backend hoje não envia. Eles servem de referência
 * para a conversa com o responsável pelo back-end e dependem da definição dele
 * (DEPENDE DO BACK-END). Nada aqui é regra de negócio confirmada.
 *
 * Convenções:
 *  - os tipos de `terminal.ts` continuam descrevendo a API atual, sem alteração;
 *  - cada interface abaixo ESTENDE o tipo atual e acrescenta só campos novos;
 *  - o documento `docs/contrato-api-proposto.md` lista cada campo, o formato
 *    esperado por tela e exemplos de payload.
 */
import type {
  Area,
  Doca,
  DashboardResumo,
  Equipamento,
  EstadoCaminhao,
  ISODateTime,
  ItemFila,
  OcorrenciaListada,
  Operacao,
  SeveridadeOcorrencia,
  UUID,
  Vaga,
} from "./terminal";

/* ---------- Recursos ---------- */

/** Área com o motivo da interdição (ex.: "piso danificado"). */
export interface AreaProposta extends Area {
  /** PROPOSTA. Texto livre; só faz sentido quando `interditada` é verdadeiro. */
  motivo_interdicao: string | null;
}

export interface VagaProposta extends Omit<Vaga, "area"> {
  /** PROPOSTA. Código de exibição ("V05"). Hoje o backend só envia o UUID. */
  codigo: string;
  area: AreaProposta;
}

/**
 * Condição de interrupção registrada numa doca (PROPOSTA).
 * Segue o ciclo de vida atual do back-end (`Operacao.interromper` →
 * `liberar_recursos(manter_vaga=True)`): a operação volta a AGUARDANDO_RECURSO,
 * a doca e o equipamento são liberados e a vaga é mantida. Por isso o `estado`
 * da doca continua LIVRE; a interrupção é uma condição à parte, que explica
 * por que a doca não recebe (DEPENDE DO BACK-END confirmar o formato).
 */
export interface InterrupcaoDoca {
  operacao_id: UUID;
  interrompida_em: ISODateTime;
  /** Minutos já operados quando a operação foi interrompida. */
  minutos_operados: number;
  ocorrencia_id: UUID | null;
}

/** Restrição informada pelo sistema para uma doca livre (texto do sistema). */
export interface RestricaoDoca {
  /** Código estável para a interface decidir ícone/rotulagem curta. */
  codigo: "SEM_EQUIPAMENTO_COMPATIVEL";
  /** Texto completo exibido em "Por que não recebe?". */
  texto: string;
  /** Ocorrência aberta que causa a restrição ("Causa relacionada"), se houver. */
  ocorrencia_id: UUID | null;
}

export interface DocaProposta extends Omit<Doca, "area"> {
  /** PROPOSTA. Código de exibição ("D3"). */
  codigo: string;
  area: AreaProposta;
  /** PROPOSTA. Previsão de fim de manutenção ("até 16:30"). */
  manutencao_ate: ISODateTime | null;
  /** PROPOSTA. Ver `InterrupcaoDoca`. */
  interrupcao: InterrupcaoDoca | null;
  /** PROPOSTA. Presente em doca livre que o sistema não considera alocável. */
  restricao: RestricaoDoca | null;
}

export interface RecursosProposta {
  vagas: VagaProposta[];
  docas: DocaProposta[];
  equipamentos: Equipamento[];
}

/* ---------- Operação ---------- */

/** Campos acrescentados à operação. Todos opcionais para tolerar a API atual. */
export interface OperacaoProposta extends Operacao {
  /**
   * PROPOSTA — ILUSTRATIVO. Duração estimada da operação, em minutos. O
   * backend não tem esse conceito; o valor dos mocks é inventado para
   * demonstrar a barra de progresso e SEMPRE deve aparecer identificado como
   * estimativa simulada.
   */
  duracao_estimada_minutos: number | null;
}

/* ---------- Fila ---------- */

export interface ItemFilaProposto extends ItemFila {
  /**
   * PROPOSTA. Texto do sistema que explica por que o caminhão ainda espera
   * (ex.: "Aguarda EQ-02 (quebrado)"). Não é regra do front-end.
   */
  motivo_espera: string | null;
}

/**
 * PROPOSTA — endpoint novo. Consulta contextual: docas que o SISTEMA considera
 * compatíveis com a carga de um caminhão e a situação de cada uma. O front-end
 * apenas exibe; não aloca nem prioriza doca.
 */
export interface DocasCompativeis {
  operacao_id: UUID;
  docas: Array<{
    doca_id: UUID;
    /** Texto curto do sistema: "PQR-1A11 em operação", "Livre · sem equipamento compatível livre". */
    situacao: string;
    /** `false` quando a doca é compatível, mas hoje não pode receber o caminhão. */
    disponivel: boolean;
  }>;
}

/* ---------- Ocorrência ---------- */

export type RotuloMetricaImpacto = "espera máxima" | "parada" | "na etapa";

/** Operação afetada por uma ocorrência e o peso do impacto SOBRE ela. */
export interface OperacaoAfetada {
  operacao_id: UUID;
  /** PROPOSTA. Severidade do impacto nesta operação (pode diferir da ocorrência). */
  severidade: SeveridadeOcorrencia;
}

export interface OcorrenciaProposta extends OcorrenciaListada {
  /** PROPOSTA. Título curto de lista ("EQ-02 quebrada"). */
  titulo: string;
  /**
   * PROPOSTA. Operações afetadas. A API atual liga a ocorrência a UMA operação
   * (`operacao_id`); o design mostra "Afeta N caminhões". Inclui a operação de
   * origem.
   */
  operacoes_afetadas: OperacaoAfetada[];
  /** PROPOSTA. Métrica de impacto exibida na lista, definida pelo back-end. */
  metrica_impacto: { minutos: number; rotulo: RotuloMetricaImpacto } | null;
}

/* ---------- Painel ---------- */

/** Faixa de espera da etapa, definida pelo sistema (PROPOSTA; sem nomes definidos). */
export type FaixaEspera = "normal" | "atencao" | "critica";

export interface EtapaFluxo {
  estado: EstadoCaminhao;
  quantidade: number;
  /** Média por etapa (hoje em `GET /api/reports/timings`). */
  media_minutos: number | null;
  /** PROPOSTA. Destaque da etapa conforme faixas de espera do sistema. */
  faixa_espera: FaixaEspera;
}

export interface DashboardProposto extends DashboardResumo {
  /** PROPOSTA. Etapas já com média e faixa, na ordem do fluxo. */
  etapas: EtapaFluxo[];
  /** PROPOSTA. Caminhões finalizados no dia ("hoje"), fora dos ativos. */
  finalizados_hoje: number;
}
