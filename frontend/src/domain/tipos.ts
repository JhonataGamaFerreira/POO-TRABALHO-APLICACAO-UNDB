/**
 * Estado do terminal no front-end (normalizado).
 *
 * ESPELHO DO BACK-END: os nomes, os enums e as regras deste diretório seguem
 * `main.py` / `api.py` (backend, commit b16a874). Nada aqui cria regra nova.
 * Quando a API real for integrada, esta camada (domain + store) é substituída
 * por chamadas HTTP e as telas continuam lendo o mesmo formato `Terminal`
 * (ver `src/store/selecionar.ts`).
 *
 * Normalizado: a operação guarda só os ids de vaga, doca e equipamento. As
 * cópias aninhadas do formato da API são montadas pelo seletor, nunca
 * persistidas, para que não existam duas versões do mesmo recurso.
 */
import type {
  Caminhao,
  Carga,
  CaracteristicaCarga,
  Equipamento,
  EstadoCaminhao,
  EstadoRecurso,
  EventoHistorico,
  ImpactoOcorrencia,
  Inspecao,
  ISODateTime,
  Ocorrencia,
  RecursoTipo,
  RelatorioTempos,
  TipoOperacao,
  UUID,
} from "@/types/terminal";
import type { OperacaoAfetada, RotuloMetricaImpacto } from "@/types/terminal-proposto";

export type FuncaoFuncionario =
  | "RECEPCAO"
  | "INSPETOR"
  | "OPERADOR"
  | "SUPERVISOR"
  | "ADMINISTRADOR";

export interface Funcionario {
  id: UUID;
  nome: string;
  funcao: FuncaoFuncionario;
  /** "carga" e/ou "descarga" (`Funcionario.habilitado_para`). */
  habilitacoes: TipoOperacao[];
}

export interface AreaE {
  id: UUID;
  nome: string;
  autorizada_carga_perigosa: boolean;
  refrigerada: boolean;
  interditada: boolean;
  /** PROPOSTA (não existe na API). */
  motivo_interdicao: string | null;
}

export interface VagaE {
  id: UUID;
  /** PROPOSTA de exibição ("V05"). */
  codigo: string;
  area_id: UUID;
  estado: EstadoRecurso;
  operacao_id: UUID | null;
}

export interface DocaE {
  id: UUID;
  /** PROPOSTA de exibição ("D3"). */
  codigo: string;
  area_id: UUID;
  tipo: TipoOperacao | null;
  estado: EstadoRecurso;
  operacao_id: UUID | null;
  /** PROPOSTA. Previsão de fim de manutenção (só do cenário inicial). */
  manutencao_ate: ISODateTime | null;
}

export type EquipamentoE = Equipamento;

/**
 * Condição de interrupção (PROPOSTA). A interrupção não é um estado do recurso:
 * a doca volta a LIVRE e a vaga é mantida. Este registro explica por que a
 * doca de origem não recebe; vive enquanto a operação aguarda recurso.
 */
export interface InterrupcaoE {
  doca_id: UUID | null;
  interrompida_em: ISODateTime;
  minutos_operados: number;
  ocorrencia_id: UUID | null;
}

export interface OperacaoE {
  id: UUID;
  caminhao: Caminhao;
  carga: Carga;
  tipo: TipoOperacao;
  chegada_em: ISODateTime;
  estado: EstadoCaminhao;
  documentacao_regular: boolean;
  vaga_id: UUID | null;
  doca_id: UUID | null;
  equipamento_id: UUID | null;
  funcionario_responsavel_id: UUID | null;
  iniciada_em: ISODateTime | null;
  finalizada_em: ISODateTime | null;
  cancelada: boolean;
  motivo_cancelamento: string | null;
  historico: EventoHistorico[];
  inspecoes: Inspecao[];
  /** PROPOSTA/ILUSTRATIVO (só no cenário inicial). */
  duracao_estimada_minutos: number | null;
  /** PROPOSTA. Presente enquanto a operação interrompida aguarda recurso. */
  interrupcao: InterrupcaoE | null;
}

export interface OcorrenciaE extends Ocorrencia {
  operacao_id: UUID;
  /** PROPOSTA. Sem título, a tela monta "Tipo · recurso". */
  titulo: string | null;
  /** PROPOSTA. Sem o campo, afeta só a operação de origem. */
  operacoes_afetadas: OperacaoAfetada[] | null;
  /** PROPOSTA. Rótulo da métrica; os minutos são calculados com o relógio. */
  metrica_rotulo: RotuloMetricaImpacto | null;
}

/** `PoliticaFila` (main.py): pesos por característica e bônus por minuto. */
export interface PoliticaFila {
  pesos: Partial<Record<CaracteristicaCarga, number>>;
  bonus_por_minuto: number;
}

export const VERSAO_ESQUEMA = 1;

export interface EstadoTerminal {
  versao: typeof VERSAO_ESQUEMA;
  /** Instante (real) em que o cenário foi criado ou restaurado. */
  criado_em: ISODateTime;
  areas: AreaE[];
  vagas: VagaE[];
  docas: DocaE[];
  equipamentos: EquipamentoE[];
  funcionarios: Funcionario[];
  operacoes: OperacaoE[];
  ocorrencias: OcorrenciaE[];
  politica: PoliticaFila;
  /** Médias por etapa do cenário inicial (ilustrativas; não recalculadas). */
  tempos: RelatorioTempos;
}

/* ---------- Ações ---------- */

export interface NovaOperacao {
  nome_motorista: string;
  documento_motorista: string;
  placa: string;
  transportadora: string;
  descricao_carga: string;
  caracteristicas: CaracteristicaCarga[];
  tipo: TipoOperacao;
  documentacao_regular: boolean;
  exige_inspecao: boolean;
}

export type Acao =
  | { tipo: "criar-operacao"; dados: NovaOperacao }
  | { tipo: "documentation"; operacaoId: UUID; regular: boolean }
  | { tipo: "inspection"; operacaoId: UUID; resultado: string; aprovado: boolean }
  | { tipo: "yard-entry"; operacaoId: UUID; vagaId: UUID }
  | { tipo: "start"; operacaoId: UUID }
  | {
      tipo: "interrupt";
      operacaoId: UUID;
      descricao: string;
      equipamentoQuebrado: boolean;
      severidade: Ocorrencia["severidade"];
      impacto: ImpactoOcorrencia;
      recurso?: { tipo: RecursoTipo; id: UUID } | null;
    }
  | { tipo: "cancel"; operacaoId: UUID; motivo: string }
  | { tipo: "finish"; operacaoId: UUID }
  | { tipo: "release"; operacaoId: UUID }
  | { tipo: "resolve-occurrence"; ocorrenciaId: UUID }
  | {
      tipo: "maintenance";
      recurso: { tipo: "vaga" | "doca" | "equipment"; id: UUID };
      emManutencao: boolean;
    }
  | { tipo: "area-interdicao"; areaId: UUID; interditada: boolean; motivo?: string | null };

/** O que o chamador precisa saber depois de uma ação bem-sucedida. */
export interface ResultadoAcao {
  /** Mensagem curta para o aviso de confirmação. */
  mensagem: string;
  /** Para `start`: false quando faltou recurso e a operação passou a aguardar. */
  iniciada?: boolean;
  /** Para `criar-operacao`: id da nova operação. */
  operacaoId?: UUID;
}

/** Violação de regra de negócio (`ErroDeDominio` no backend). */
export class ErroDeDominio extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeDominio";
  }
}

/** Relógio e gerador de ids injetáveis (testes determinísticos). */
export interface Contexto {
  agora: Date;
  novoId: () => UUID;
}
