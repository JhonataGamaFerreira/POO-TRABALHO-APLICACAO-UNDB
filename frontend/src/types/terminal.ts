/**
 * Contrato de dados do terminal, espelhando as respostas de `api.py`
 * (backend, commit b16a874). Campos em snake_case e valores de enum idênticos
 * aos serializados pela API:
 *  - enums com valor textual saem como valor ("carga", "frágil", "critica");
 *  - enums automáticos saem como NOME ("NO_PATIO", "LIVRE").
 * Nada aqui foi inventado: o que o backend não envia não aparece nestes tipos.
 */

export type UUID = string;
/** Data e hora ISO 8601 com fuso. */
export type ISODateTime = string;

export type TipoOperacao = "carga" | "descarga";

export type CaracteristicaCarga =
  | "comum"
  | "frágil"
  | "refrigerada"
  | "perigosa"
  | "prioritária";

/** Etapas do fluxo (EstadoCaminhao). */
export type EstadoCaminhao =
  | "AGUARDANDO_DOCUMENTACAO"
  | "AGUARDANDO_INSPECAO"
  | "AGUARDANDO_ENTRADA"
  | "NO_PATIO"
  | "AGUARDANDO_RECURSO"
  | "EM_OPERACAO"
  | "AGUARDANDO_LIBERACAO"
  | "FINALIZADO";

/**
 * Estados de recurso conhecidos pelo backend. Bloqueado, Quebrado e
 * Interrompida NÃO existem aqui: dependem de definição do back-end.
 */
export type EstadoRecurso =
  | "LIVRE"
  | "DISPONIVEL"
  | "OCUPADO"
  | "EM_MANUTENCAO";

export type EstadoOcorrencia = "ABERTA" | "RESOLVIDA";

export type SeveridadeOcorrencia = "baixa" | "media" | "alta" | "critica";

export type ImpactoOcorrencia =
  | "operacao"
  | "recurso"
  | "seguranca"
  | "ambiental"
  | "outro";

export type TipoOcorrencia =
  | "EQUIPAMENTO_QUEBRADO"
  | "DOCUMENTACAO_IRREGULAR"
  | "CARGA_DIVERGENTE"
  | "ACIDENTE"
  | "AREA_INTERDITADA"
  | "ATRASO"
  | "CANCELAMENTO";

export type TipoEvento =
  | "MUDANCA_ESTADO"
  | "ALOCACAO_RECURSO"
  | "OCORRENCIA"
  | "INSPECAO"
  | "OPERACAO_INICIADA"
  | "OPERACAO_FINALIZADA"
  /**
   * SÓ DO FRONT/STORE: o backend não tem este tipo (`TipoEvento` em main.py) nem
   * grava evento na chegada. A store o registra ao criar a operação para que o
   * histórico local mostre quando e por quem a chegada foi registrada. Proposta
   * ao backend em docs/contrato-api-proposto.md; ao integrar a API, o front
   * continua gerando este evento enquanto o backend não o enviar.
   */
  | "CHEGADA";

/** Valores aceitos em `recurso_tipo` de uma ocorrência. */
export type RecursoTipo = "area" | "vaga" | "doca" | "equipment";

export interface Motorista {
  id: UUID;
  nome: string;
  documento: string;
}

export interface Transportadora {
  id: UUID;
  nome: string;
}

export interface Caminhao {
  id: UUID;
  placa: string;
  motorista: Motorista;
  transportadora: Transportadora;
}

export interface Carga {
  descricao: string;
  caracteristicas: CaracteristicaCarga[];
}

export interface Area {
  id: UUID;
  nome: string;
  autorizada_carga_perigosa: boolean;
  refrigerada: boolean;
  interditada: boolean;
}

export interface Vaga {
  id: UUID;
  area: Area;
  estado: EstadoRecurso;
  operacao_id: UUID | null;
}

export interface Doca {
  id: UUID;
  area: Area;
  tipo: TipoOperacao | null;
  estado: EstadoRecurso;
  operacao_id: UUID | null;
}

export interface Equipamento {
  id: UUID;
  nome: string;
  tipos_compativeis: TipoOperacao[];
  aceita_carga_fragil: boolean;
  estado: EstadoRecurso;
  operacao_id: UUID | null;
}

export interface EventoHistorico {
  id: UUID;
  tipo: TipoEvento;
  ocorrido_em: ISODateTime;
  responsavel_id: UUID;
  descricao: string;
  estado_anterior: EstadoCaminhao | null;
  estado_novo: EstadoCaminhao | null;
}

export interface Inspecao {
  resultado: string;
  responsavel_id: UUID;
  realizada_em: ISODateTime;
}

export interface Ocorrencia {
  id: UUID;
  tipo: TipoOcorrencia;
  descricao: string;
  responsavel_id: UUID;
  criada_em: ISODateTime;
  estado: EstadoOcorrencia;
  resolvida_em: ISODateTime | null;
  resolvida_por: UUID | null;
  severidade: SeveridadeOcorrencia;
  impacto: ImpactoOcorrencia;
  recurso_tipo: RecursoTipo | null;
  recurso_id: UUID | null;
}

/** Item de `GET /api/occurrences` (acrescenta a operação de origem). */
export interface OcorrenciaListada extends Ocorrencia {
  operacao_id: UUID;
}

/** Ações que o backend informa em `acoes_permitidas`. */
export type AcaoOperacao =
  | "documentation"
  | "inspection"
  | "yard-entry"
  | "start"
  | "interrupt"
  | "cancel"
  | "finish"
  | "release";

export interface Operacao {
  id: UUID;
  caminhao: Caminhao;
  carga: Carga;
  tipo: TipoOperacao;
  chegada_em: ISODateTime;
  estado: EstadoCaminhao;
  documentacao_regular: boolean;
  vaga: Vaga | null;
  doca: Doca | null;
  equipamento: Equipamento | null;
  funcionario_responsavel_id: UUID | null;
  iniciada_em: ISODateTime | null;
  finalizada_em: ISODateTime | null;
  cancelada: boolean;
  motivo_cancelamento: string | null;
  historico: EventoHistorico[];
  ocorrencias: Ocorrencia[];
  inspecoes: Inspecao[];
  acoes_permitidas: AcaoOperacao[];
  tempos_minutos: { espera: number; operacao: number };
}

/** Fator estruturado de `GET /api/queue`. */
export type FatorFila =
  | { tipo: "caracteristica"; caracteristica: CaracteristicaCarga; peso: number }
  | {
      tipo: "tempo_espera";
      minutos: number;
      bonus_por_minuto: number;
      pontos: number;
    };

/** Item de `GET /api/queue`. A ordem e a posição são definidas pelo backend. */
export interface ItemFila {
  operacao_id: UUID;
  placa: string;
  carga: Carga;
  estado: EstadoCaminhao;
  posicao: number;
  espera_minutos: number;
  pontuacao: number;
  fatores: FatorFila[];
}

type ContagemPorEstadoRecurso = Record<EstadoRecurso, number>;

/** `GET /api/dashboard`. */
export interface DashboardResumo {
  total_operacoes: number;
  por_estado: Record<EstadoCaminhao, number>;
  recursos: {
    vagas: ContagemPorEstadoRecurso;
    docas: ContagemPorEstadoRecurso;
    equipamentos: ContagemPorEstadoRecurso;
  };
}

/** `GET /api/reports/timings`. */
export interface RelatorioTempos {
  media_espera_minutos: number;
  media_operacao_minutos: number;
  media_por_etapa_minutos: Partial<Record<EstadoCaminhao, number>>;
  amostras: { espera: number; operacao: number };
}

/** `GET /api/resources`. */
export interface Recursos {
  vagas: Vaga[];
  docas: Doca[];
  equipamentos: Equipamento[];
}
