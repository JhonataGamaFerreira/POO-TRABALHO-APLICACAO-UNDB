/**
 * DADOS SIMULADOS. Nada aqui vem do backend nem está atualizado em tempo real.
 *
 * Dois níveis de fidelidade convivem neste arquivo:
 *  1. Os objetos seguem o contrato ATUAL de `api.py` (src/types/terminal.ts).
 *     O cenário é composto para reproduzir os wireframes aprovados e prioriza a
 *     coerência operacional visível na interface:
 *      - caminhão em operação ocupa doca (e equipamento, quando a carga exige);
 *      - caminhão aguardando liberação volta a uma vaga do pátio;
 *      - equipamento quebrado fica EM_MANUTENCAO e gera ocorrência;
 *      - carga perigosa e refrigerada só estão em área compatível.
 *     Diferenças em relação às regras atuais do backend (ocupação de vaga durante
 *     a operação, liberação da doca ao interromper) estão em
 *     docs/contrato-api-proposto.md.
 *  2. Campos marcados PROPOSTA (src/types/terminal-proposto.ts) NÃO existem na
 *     API. Foram acrescentados para alimentar as telas aprovadas no Figma e
 *     formam a proposta de contrato futuro (docs/contrato-api-proposto.md).
 *
 * O cenário reproduz a história dos wireframes A1–B3 (EQ-02 quebrado afeta
 * dois caminhões; D3 interrompida; D4 em manutenção; V09 bloqueada; D7 livre
 * sem equipamento compatível), com contagens que decorrem dos próprios dados.
 * Instante de referência fixo (não depende do relógio da máquina).
 */
import type {
  AcaoOperacao,
  Caminhao,
  Carga,
  CaracteristicaCarga,
  EstadoCaminhao,
  Equipamento,
  EventoHistorico,
  Ocorrencia,
  RelatorioTempos,
  TipoOperacao,
} from "@/types/terminal";
import type {
  AreaProposta,
  DashboardProposto,
  DocaProposta,
  DocasCompativeis,
  EtapaFluxo,
  ItemFilaProposto,
  OcorrenciaProposta,
  OperacaoProposta,
  RecursosProposta,
  VagaProposta,
} from "@/types/terminal-proposto";

export const MOCK_AGORA = "2026-11-06T14:35:00-03:00";
const T0 = Date.parse(MOCK_AGORA);
const atras = (min: number) => new Date(T0 - min * 60_000).toISOString();
const depois = (min: number) => new Date(T0 + min * 60_000).toISOString();
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RESPONSAVEL = uid(801);
const opId = (n: number) => uid(500 + n);

/* ---------- Áreas, vagas, docas, equipamentos ---------- */

const area = (
  n: number,
  nome: string,
  extra: Partial<AreaProposta> = {},
): AreaProposta => ({
  id: uid(100 + n),
  nome,
  autorizada_carga_perigosa: false,
  refrigerada: false,
  interditada: false,
  motivo_interdicao: null,
  ...extra,
});

const AREA_GERAL = area(1, "Área Geral");
const AREA_REFRIGERADA = area(2, "Área Refrigerada", { refrigerada: true });
const AREA_PERIGOSOS = area(3, "Área Perigosos", { autorizada_carga_perigosa: true });
/** Área interditada: só a vaga V09 pertence a ela (wireframe: "V09, piso danificado"). */
const AREA_NORTE = area(4, "Área Norte", {
  interditada: true,
  motivo_interdicao: "piso danificado",
});
export const MOCK_AREAS: AreaProposta[] = [
  AREA_GERAL,
  AREA_REFRIGERADA,
  AREA_PERIGOSOS,
  AREA_NORTE,
];

const vaga = (n: number, a: AreaProposta): VagaProposta => ({
  id: uid(200 + n),
  codigo: `V${String(n).padStart(2, "0")}`,
  area: a,
  estado: "LIVRE",
  operacao_id: null,
});
const doca = (n: number, a: AreaProposta): DocaProposta => ({
  id: uid(300 + n),
  codigo: `D${n}`,
  area: a,
  tipo: null,
  estado: "LIVRE",
  operacao_id: null,
  manutencao_ate: null,
  interrupcao: null,
  restricao: null,
});
const equip = (n: number, tipos: TipoOperacao[], fragil = false): Equipamento => ({
  id: uid(400 + n),
  nome: `EQ-${String(n).padStart(2, "0")}`,
  tipos_compativeis: tipos,
  aceita_carga_fragil: fragil,
  estado: "DISPONIVEL",
  operacao_id: null,
});

const V = [
  vaga(1, AREA_GERAL), vaga(2, AREA_GERAL), vaga(3, AREA_GERAL), vaga(4, AREA_GERAL),
  vaga(5, AREA_PERIGOSOS), vaga(6, AREA_REFRIGERADA), vaga(7, AREA_GERAL),
  vaga(8, AREA_GERAL), vaga(9, AREA_NORTE), vaga(10, AREA_GERAL),
  vaga(11, AREA_GERAL), vaga(12, AREA_GERAL),
];
const D = [
  doca(1, AREA_PERIGOSOS), doca(2, AREA_GERAL), doca(3, AREA_GERAL),
  doca(4, AREA_REFRIGERADA), doca(5, AREA_GERAL), doca(6, AREA_PERIGOSOS),
  doca(7, AREA_PERIGOSOS), doca(8, AREA_GERAL),
];
const E = [
  equip(1, ["carga", "descarga"]),
  equip(2, ["carga", "descarga"]),
  equip(4, ["carga", "descarga"], true),
  equip(5, ["carga", "descarga"]),
  equip(6, ["carga", "descarga"]),
];
const [EQ01, EQ02, EQ04, EQ05, EQ06] = E;
D[3].estado = "EM_MANUTENCAO"; // D4 em manutenção
D[3].manutencao_ate = depois(115); // até 16:30
EQ02.estado = "EM_MANUTENCAO"; // EQ-02 fora de uso (ver ocorrência 1)

/* ---------- Operações ---------- */

const ACOES: Record<EstadoCaminhao, AcaoOperacao[]> = {
  AGUARDANDO_DOCUMENTACAO: ["documentation", "cancel"],
  AGUARDANDO_INSPECAO: ["inspection", "cancel"],
  AGUARDANDO_ENTRADA: ["yard-entry", "cancel"],
  NO_PATIO: ["start", "interrupt", "cancel"],
  AGUARDANDO_RECURSO: ["start", "interrupt", "cancel"],
  EM_OPERACAO: ["finish", "interrupt"],
  AGUARDANDO_LIBERACAO: ["release"],
  FINALIZADO: [],
};

interface EntradaOperacao {
  n: number;
  placa: string;
  motorista: string;
  transportadora: string;
  carga: string;
  caracteristicas: CaracteristicaCarga[];
  tipo: TipoOperacao;
  estado: EstadoCaminhao;
  /** Minutos desde a chegada. */
  chegadaMin: number;
  /** Transições após a chegada: [minutos atrás, estado novo]. */
  percurso?: Array<[number, EstadoCaminhao]>;
  inicial?: EstadoCaminhao;
  vaga?: VagaProposta;
  doca?: DocaProposta;
  equipamento?: Equipamento;
  iniciadaMin?: number;
  finalizadaMin?: number;
  /** Minutos operados quando a operação foi interrompida (se diferir de iniciada→agora). */
  operadoMin?: number;
  /** PROPOSTA/ILUSTRATIVO: duração estimada simulada (min). */
  estimativaMin?: number;
  regular?: boolean;
  /** Ações próprias do estado (ex.: operação interrompida). */
  acoes?: AcaoOperacao[];
  ocorrencias?: Ocorrencia[];
}

const ORIGEM_OCORRENCIA = new Map<string, string>();

function operacao(e: EntradaOperacao): OperacaoProposta {
  const caminhao: Caminhao = {
    id: uid(600 + e.n),
    placa: e.placa,
    motorista: { id: uid(650 + e.n), nome: e.motorista, documento: `DOC-${e.n}0${e.n}` },
    transportadora: { id: uid(2000 + e.n), nome: e.transportadora },
  };
  const carga: Carga = { descricao: e.carga, caracteristicas: e.caracteristicas };
  const id = opId(e.n);

  let anterior: EstadoCaminhao = e.inicial ?? "AGUARDANDO_DOCUMENTACAO";
  const historico: EventoHistorico[] = (e.percurso ?? []).map(([min, novo], i) => {
    const ev: EventoHistorico = {
      id: uid(900 + e.n * 10 + i),
      tipo: "MUDANCA_ESTADO",
      ocorrido_em: atras(min),
      responsavel_id: RESPONSAVEL,
      descricao: `Estado alterado para ${novo}.`,
      estado_anterior: anterior,
      estado_novo: novo,
    };
    anterior = novo;
    return ev;
  });
  const ocorrencias = e.ocorrencias ?? [];
  ocorrencias.forEach((o, i) => {
    ORIGEM_OCORRENCIA.set(o.id, id);
    historico.push({
      id: uid(950 + e.n * 10 + i),
      tipo: "OCORRENCIA",
      ocorrido_em: o.criada_em,
      responsavel_id: RESPONSAVEL,
      descricao: o.descricao,
      estado_anterior: null,
      estado_novo: null,
    });
  });
  historico.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));

  const espera = e.chegadaMin - (e.iniciadaMin ?? 0);
  const operado =
    e.operadoMin ??
    (e.iniciadaMin !== undefined ? e.iniciadaMin - (e.finalizadaMin ?? 0) : 0);

  if (e.vaga) { e.vaga.estado = "OCUPADO"; e.vaga.operacao_id = id; }
  if (e.doca) { e.doca.estado = "OCUPADO"; e.doca.operacao_id = id; }
  if (e.equipamento) { e.equipamento.estado = "OCUPADO"; e.equipamento.operacao_id = id; }

  return {
    id,
    caminhao,
    carga,
    tipo: e.tipo,
    chegada_em: atras(e.chegadaMin),
    estado: e.estado,
    documentacao_regular: e.regular ?? true,
    vaga: e.vaga ?? null,
    doca: e.doca ?? null,
    equipamento: e.equipamento ?? null,
    funcionario_responsavel_id: RESPONSAVEL,
    iniciada_em: e.iniciadaMin !== undefined ? atras(e.iniciadaMin) : null,
    finalizada_em: e.finalizadaMin !== undefined ? atras(e.finalizadaMin) : null,
    cancelada: false,
    motivo_cancelamento: null,
    historico,
    ocorrencias,
    inspecoes: [],
    acoes_permitidas: e.acoes ?? ACOES[e.estado],
    tempos_minutos: { espera, operacao: operado },
    duracao_estimada_minutos: e.estimativaMin ?? null,
  };
}

/* Ocorrências: 3 abertas e 1 resolvida. Campos PROPOSTA entram em MOCK_OCORRENCIAS. */
const ocorrencia = (
  n: number,
  o: Omit<Ocorrencia, "id" | "responsavel_id" | "resolvida_em" | "resolvida_por"> &
    Partial<Pick<Ocorrencia, "resolvida_em" | "resolvida_por">>,
): Ocorrencia => ({
  id: uid(700 + n),
  responsavel_id: RESPONSAVEL,
  resolvida_em: null,
  resolvida_por: null,
  ...o,
});

const OC_EQ02 = ocorrencia(1, {
  tipo: "EQUIPAMENTO_QUEBRADO",
  descricao: "EQ-02 quebrada durante a operação de FGH-2J34.",
  criada_em: atras(90),
  estado: "ABERTA",
  severidade: "critica",
  impacto: "recurso",
  recurso_tipo: "equipment",
  recurso_id: EQ02.id,
});
const OC_OPERADOR = ocorrencia(2, {
  tipo: "ATRASO",
  descricao: "Descarga de VWX-3C33 interrompida (58 de 90 min estimados), parada há 38 min.",
  criada_em: atras(38),
  estado: "ABERTA",
  severidade: "media",
  impacto: "operacao",
  recurso_tipo: "doca",
  recurso_id: D[2].id,
});
const OC_DOC = ocorrencia(3, {
  tipo: "DOCUMENTACAO_IRREGULAR",
  descricao: "Pré-entrada, retido na etapa Documentação.",
  criada_em: atras(25),
  estado: "ABERTA",
  severidade: "media",
  impacto: "operacao",
  recurso_tipo: null,
  recurso_id: null,
});
const OC_RESOLVIDA = ocorrencia(4, {
  tipo: "ATRASO",
  descricao: "Atraso na inspeção de MNO-6F66.",
  criada_em: atras(300),
  estado: "RESOLVIDA",
  resolvida_em: atras(280),
  resolvida_por: RESPONSAVEL,
  severidade: "baixa",
  impacto: "operacao",
  recurso_tipo: null,
  recurso_id: null,
});

export const MOCK_OPERACOES: OperacaoProposta[] = [
  operacao({
    n: 1, placa: "ABC-1D23", motorista: "Carlos Mendes", transportadora: "TransNorte",
    carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
    estado: "AGUARDANDO_DOCUMENTACAO", chegadaMin: 25, regular: false,
    ocorrencias: [OC_DOC],
  }),
  operacao({
    n: 2, placa: "DEF-2E34", motorista: "Rita Souza", transportadora: "LogMar",
    carga: "Café em grãos", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_INSPECAO", chegadaMin: 30, inicial: "AGUARDANDO_DOCUMENTACAO",
    percurso: [[10, "AGUARDANDO_INSPECAO"]],
  }),
  operacao({
    n: 3, placa: "UVW-1H22", motorista: "Paulo Lima", transportadora: "TransNorte",
    carga: "Contêiner 20' seco", caracteristicas: ["comum"], tipo: "descarga",
    estado: "AGUARDANDO_ENTRADA", chegadaMin: 9, inicial: "AGUARDANDO_ENTRADA",
  }),
  operacao({
    n: 4, placa: "XYZ-2J33", motorista: "Ana Prado", transportadora: "Rota Sul",
    carga: "Máquinas agrícolas", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_ENTRADA", chegadaMin: 4, inicial: "AGUARDANDO_ENTRADA",
  }),
  operacao({
    n: 5, placa: "RIO-9D01", motorista: "Jonas Alves", transportadora: "LogMar",
    carga: "Eletroeletrônicos", caracteristicas: ["comum"], tipo: "descarga",
    estado: "NO_PATIO", chegadaMin: 35, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[30, "NO_PATIO"]], vaga: V[0],
  }),
  operacao({
    n: 19, placa: "TPN-3E58", motorista: "Marta Veloso", transportadora: "AgroLog",
    carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "descarga",
    estado: "NO_PATIO", chegadaMin: 12, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[8, "NO_PATIO"]], vaga: V[1],
  }),
  operacao({
    n: 6, placa: "FGH-2J34", motorista: "Edson Cruz", transportadora: "QuimTrans",
    carga: "Solvente industrial (classe 3)", caracteristicas: ["perigosa", "prioritária"],
    tipo: "descarga", estado: "AGUARDANDO_RECURSO", chegadaMin: 112,
    inicial: "AGUARDANDO_ENTRADA", vaga: V[4], iniciadaMin: 95, operadoMin: 5,
    percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [95, "EM_OPERACAO"], [90, "AGUARDANDO_RECURSO"]],
    ocorrencias: [OC_EQ02],
  }),
  operacao({
    n: 7, placa: "KLM-8P12", motorista: "Lúcia Ferraz", transportadora: "FrioSul",
    carga: "Carne bovina congelada", caracteristicas: ["refrigerada"], tipo: "carga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 80, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[70, "NO_PATIO"], [60, "AGUARDANDO_RECURSO"]], vaga: V[5],
  }),
  operacao({
    n: 8, placa: "BRA-5C67", motorista: "Nilton Gomes", transportadora: "AgroLog",
    carga: "Milho a granel", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 48, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[44, "NO_PATIO"], [40, "AGUARDANDO_RECURSO"]], vaga: V[6],
  }),
  operacao({
    n: 9, placa: "NOP-6F90", motorista: "Sônia Ribeiro", transportadora: "Rota Sul",
    carga: "Carga geral paletizada", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 41, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[38, "NO_PATIO"], [35, "AGUARDANDO_RECURSO"]], vaga: V[7],
  }),
  operacao({
    n: 10, placa: "VWX-3C33", motorista: "Davi Nunes", transportadora: "AgroLog",
    carga: "Fertilizante a granel", caracteristicas: ["comum"], tipo: "descarga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 110, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [96, "EM_OPERACAO"], [38, "AGUARDANDO_RECURSO"]],
    vaga: V[2], iniciadaMin: 96, operadoMin: 58, estimativaMin: 90,
    ocorrencias: [OC_OPERADOR],
  }),
  operacao({
    n: 11, placa: "PQR-1A11", motorista: "Sílvio Rocha", transportadora: "TransNorte",
    carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
    estado: "EM_OPERACAO", chegadaMin: 160, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[150, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [42, "EM_OPERACAO"]],
    doca: D[0], equipamento: EQ01, iniciadaMin: 42, estimativaMin: 70,
  }),
  operacao({
    n: 12, placa: "STU-2B22", motorista: "Olívia Dias", transportadora: "LogMar",
    carga: "Veículos (frágil)", caracteristicas: ["frágil"], tipo: "carga",
    estado: "EM_OPERACAO", chegadaMin: 70, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[65, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [15, "EM_OPERACAO"]],
    doca: D[1], equipamento: EQ04, iniciadaMin: 15, estimativaMin: 60,
  }),
  operacao({
    n: 13, placa: "CDE-4D44", motorista: "Heitor Lins", transportadora: "Rota Sul",
    carga: "Soja a granel", caracteristicas: ["comum"], tipo: "carga",
    estado: "EM_OPERACAO", chegadaMin: 190, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[180, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [65, "EM_OPERACAO"]],
    doca: D[4], iniciadaMin: 65, estimativaMin: 90,
  }),
  operacao({
    n: 14, placa: "GHI-5E55", motorista: "Teresa Boaventura", transportadora: "TransNorte",
    carga: "Contêineres 40' secos", caracteristicas: ["comum"], tipo: "descarga",
    estado: "EM_OPERACAO", chegadaMin: 60, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[55, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [20, "EM_OPERACAO"]],
    doca: D[5], equipamento: EQ05, iniciadaMin: 20, estimativaMin: 45,
  }),
  operacao({
    n: 15, placa: "JKL-7G45", motorista: "Rui Tavares", transportadora: "LogMar",
    carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_LIBERACAO", chegadaMin: 150, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[140, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [100, "EM_OPERACAO"], [10, "AGUARDANDO_LIBERACAO"]],
    vaga: V[9], iniciadaMin: 100, finalizadaMin: 10,
  }),
  operacao({
    n: 16, placa: "MNO-6F66", motorista: "Heloísa Pinto", transportadora: "LogMar",
    carga: "Carga geral", caracteristicas: ["comum"], tipo: "carga",
    estado: "EM_OPERACAO", chegadaMin: 90, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[85, "NO_PATIO"], [40, "AGUARDANDO_RECURSO"], [5, "EM_OPERACAO"]],
    doca: D[7], equipamento: EQ06, iniciadaMin: 5, estimativaMin: 60,
    ocorrencias: [OC_RESOLVIDA],
  }),
  // Finalizados no dia (23 no total; os 17 ativos ficam fora desta conta).
  ...Array.from({ length: 23 }, (_, i) => {
    const n = i < 2 ? 17 + i : 18 + i; // 17, 18, 20…40 (19 é TPN-3E58)
    const letras = "ABCDEFGHJKLMNPRSTUVWXYZ";
    const placa = `${letras[(i * 3) % letras.length]}${letras[(i * 5 + 2) % letras.length]}${letras[(i * 7 + 4) % letras.length]}-${(i % 9) + 1}${letras[(i * 2 + 1) % letras.length]}${(i * 3) % 10}${(i * 7) % 10}`;
    return operacao({
      n, placa, motorista: "Motorista " + n,
      transportadora: ["LogMar", "TransNorte", "Rota Sul", "AgroLog"][i % 4],
      carga: "Carga geral", caracteristicas: ["comum"],
      tipo: i % 2 ? "descarga" : "carga", estado: "FINALIZADO", chegadaMin: 420 + i * 20,
      inicial: "AGUARDANDO_ENTRADA",
      percurso: [[410 + i * 20, "NO_PATIO"], [380 + i * 20, "AGUARDANDO_RECURSO"], [340 + i * 20, "EM_OPERACAO"], [220 + i * 20, "AGUARDANDO_LIBERACAO"], [210 + i * 20, "FINALIZADO"]],
      iniciadaMin: 340 + i * 20, finalizadaMin: 220 + i * 20,
    });
  }),
];

/* ---------- Estados derivados dos recursos (PROPOSTA) ---------- */

// D3: a descarga de VWX-3C33 foi interrompida (operador ausente). Pelo ciclo de vida, a operação
// volta a AGUARDANDO_RECURSO, a doca e o equipamento são liberados e a vaga do pátio é mantida.
// A interrupção é uma condição registrada à parte (InterrupcaoDoca), não um estado do recurso.
D[2].interrupcao = {
  operacao_id: opId(10),
  interrompida_em: atras(38),
  minutos_operados: 58,
  ocorrencia_id: OC_OPERADOR.id,
};

// D7: livre, mas o sistema não a considera alocável por falta de equipamento compatível livre.
D[6].restricao = {
  codigo: "SEM_EQUIPAMENTO_COMPATIVEL",
  texto: "EQ-02 está quebrado. EQ-01, EQ-04, EQ-05 e EQ-06 estão em uso nas docas D1, D2, D6 e D8.",
  ocorrencia_id: OC_EQ02.id,
};

export const MOCK_RECURSOS: RecursosProposta = { vagas: V, docas: D, equipamentos: E };

/* ---------- Ocorrências (GET /api/occurrences + campos PROPOSTA) ---------- */

const ocorrenciaProposta = (
  o: Ocorrencia,
  extra: Pick<OcorrenciaProposta, "titulo" | "operacoes_afetadas" | "metrica_impacto">,
): OcorrenciaProposta => ({
  ...o,
  operacao_id: ORIGEM_OCORRENCIA.get(o.id)!,
  ...extra,
});

/** A ordem desta lista é a ordem de impacto (PROPOSTA: definida pelo back-end). */
export const MOCK_OCORRENCIAS: OcorrenciaProposta[] = [
  ocorrenciaProposta(OC_EQ02, {
    titulo: "EQ-02 quebrada",
    operacoes_afetadas: [
      { operacao_id: opId(6), severidade: "critica" },
      { operacao_id: opId(9), severidade: "media" },
    ],
    metrica_impacto: { minutos: 112, rotulo: "espera máxima" },
  }),
  ocorrenciaProposta(OC_OPERADOR, {
    titulo: "D3 interrompida · operador ausente",
    operacoes_afetadas: [{ operacao_id: opId(10), severidade: "media" }],
    metrica_impacto: { minutos: 38, rotulo: "parada" },
  }),
  ocorrenciaProposta(OC_DOC, {
    titulo: "ABC-1D23 · documentação irregular",
    operacoes_afetadas: [{ operacao_id: opId(1), severidade: "media" }],
    metrica_impacto: { minutos: 25, rotulo: "na etapa" },
  }),
  ocorrenciaProposta(OC_RESOLVIDA, {
    titulo: "MNO-6F66 · atraso na inspeção",
    operacoes_afetadas: [{ operacao_id: opId(16), severidade: "baixa" }],
    metrica_impacto: null,
  }),
];

/* ---------- Fila (GET /api/queue + motivo_espera PROPOSTA) ---------- */

/**
 * Resposta pronta do sistema: posição, pontuação e fatores já vêm definidos
 * (como se retornados pela API). O front-end não calcula nem reordena.
 */
const fator = (caracteristica: CaracteristicaCarga, peso: number) => ({
  tipo: "caracteristica" as const,
  caracteristica,
  peso,
});

export const MOCK_FILA: ItemFilaProposto[] = [
  {
    operacao_id: opId(6), placa: "FGH-2J34",
    carga: { descricao: "Solvente industrial (classe 3)", caracteristicas: ["perigosa", "prioritária"] },
    estado: "AGUARDANDO_RECURSO", posicao: 1, espera_minutos: 112, pontuacao: 206,
    fatores: [fator("perigosa", 50), fator("prioritária", 100), { tipo: "tempo_espera", minutos: 112, bonus_por_minuto: 0.5, pontos: 56 }],
    motivo_espera: "Aguarda EQ-02 (quebrado)",
  },
  {
    operacao_id: opId(7), placa: "KLM-8P12",
    carga: { descricao: "Carne bovina congelada", caracteristicas: ["refrigerada"] },
    estado: "AGUARDANDO_RECURSO", posicao: 2, espera_minutos: 80, pontuacao: 70,
    fatores: [fator("refrigerada", 30), { tipo: "tempo_espera", minutos: 80, bonus_por_minuto: 0.5, pontos: 40 }],
    motivo_espera: "Sem doca refrigerada livre; D4 em manutenção",
  },
  {
    operacao_id: opId(10), placa: "VWX-3C33",
    carga: { descricao: "Fertilizante a granel", caracteristicas: ["comum"] },
    estado: "AGUARDANDO_RECURSO", posicao: 3, espera_minutos: 110, pontuacao: 55,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 110, bonus_por_minuto: 0.5, pontos: 55 }],
    motivo_espera: "Operação interrompida na D3",
  },
  {
    operacao_id: opId(8), placa: "BRA-5C67",
    carga: { descricao: "Milho a granel", caracteristicas: ["comum"] },
    estado: "AGUARDANDO_RECURSO", posicao: 4, espera_minutos: 48, pontuacao: 24,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 48, bonus_por_minuto: 0.5, pontos: 24 }],
    motivo_espera: "D5 ocupada",
  },
  {
    operacao_id: opId(9), placa: "NOP-6F90",
    carga: { descricao: "Carga geral paletizada", caracteristicas: ["comum"] },
    estado: "AGUARDANDO_RECURSO", posicao: 5, espera_minutos: 41, pontuacao: 20.5,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 41, bonus_por_minuto: 0.5, pontos: 20.5 }],
    motivo_espera: "Aguarda EQ-02 (quebrado)",
  },
  {
    operacao_id: opId(5), placa: "RIO-9D01",
    carga: { descricao: "Eletroeletrônicos", caracteristicas: ["comum"] },
    estado: "NO_PATIO", posicao: 6, espera_minutos: 35, pontuacao: 17.5,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 35, bonus_por_minuto: 0.5, pontos: 17.5 }],
    motivo_espera: null,
  },
  {
    operacao_id: opId(19), placa: "TPN-3E58",
    carga: { descricao: "Papel em bobinas", caracteristicas: ["comum"] },
    estado: "NO_PATIO", posicao: 7, espera_minutos: 12, pontuacao: 6,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 12, bonus_por_minuto: 0.5, pontos: 6 }],
    motivo_espera: null,
  },
  {
    operacao_id: opId(3), placa: "UVW-1H22",
    carga: { descricao: "Contêiner 20' seco", caracteristicas: ["comum"] },
    estado: "AGUARDANDO_ENTRADA", posicao: 8, espera_minutos: 9, pontuacao: 4.5,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 9, bonus_por_minuto: 0.5, pontos: 4.5 }],
    motivo_espera: null,
  },
  {
    operacao_id: opId(4), placa: "XYZ-2J33",
    carga: { descricao: "Máquinas agrícolas", caracteristicas: ["comum"] },
    estado: "AGUARDANDO_ENTRADA", posicao: 9, espera_minutos: 4, pontuacao: 2,
    fatores: [fator("comum", 0), { tipo: "tempo_espera", minutos: 4, bonus_por_minuto: 0.5, pontos: 2 }],
    motivo_espera: null,
  },
];

/* ---------- Docas compatíveis (endpoint PROPOSTO) ---------- */

/** Código de doca → id (D1 = 301, …). */
const docaId = (n: number) => uid(300 + n);
const livreSemEquipamento = "Livre · sem equipamento compatível livre";
const interrompidaD3 = "Livre · operação interrompida";

/**
 * Resposta pronta da consulta contextual: cada caminhão traz a lista de docas
 * compatíveis e a situação de cada uma. O front-end só exibe.
 */
const DOCAS_PERIGOSA = [
  { doca_id: docaId(1), situacao: "PQR-1A11 em operação", disponivel: false },
  { doca_id: docaId(6), situacao: "GHI-5E55 em operação", disponivel: false },
  { doca_id: docaId(7), situacao: livreSemEquipamento, disponivel: false },
];
const DOCAS_CARGA_COMUM = [
  { doca_id: docaId(1), situacao: "PQR-1A11 em operação", disponivel: false },
  { doca_id: docaId(2), situacao: "STU-2B22 em operação", disponivel: false },
  { doca_id: docaId(3), situacao: interrompidaD3, disponivel: false },
  { doca_id: docaId(5), situacao: "CDE-4D44 em operação", disponivel: false },
  { doca_id: docaId(6), situacao: "GHI-5E55 em operação", disponivel: false },
  { doca_id: docaId(7), situacao: livreSemEquipamento, disponivel: false },
  { doca_id: docaId(8), situacao: "MNO-6F66 em operação", disponivel: false },
];

export const MOCK_DOCAS_COMPATIVEIS: DocasCompativeis[] = [
  { operacao_id: opId(6), docas: DOCAS_PERIGOSA },
  { operacao_id: opId(7), docas: [] },
  ...[10, 8, 9, 5, 19, 3, 4].map((n) => ({ operacao_id: opId(n), docas: DOCAS_CARGA_COMUM })),
];

/* ---------- Relatório de tempos e painel ---------- */

/** `GET /api/reports/timings` (valores ilustrativos). */
export const MOCK_TEMPOS: RelatorioTempos = {
  media_espera_minutos: 58,
  media_operacao_minutos: 34,
  media_por_etapa_minutos: {
    AGUARDANDO_DOCUMENTACAO: 25,
    AGUARDANDO_INSPECAO: 10,
    AGUARDANDO_ENTRADA: 7,
    NO_PATIO: 24,
    AGUARDANDO_RECURSO: 70,
    EM_OPERACAO: 34,
    AGUARDANDO_LIBERACAO: 6,
  },
  amostras: { espera: 18, operacao: 8 },
};

const ESTADOS: EstadoCaminhao[] = [
  "AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "NO_PATIO",
  "AGUARDANDO_RECURSO", "EM_OPERACAO", "AGUARDANDO_LIBERACAO", "FINALIZADO",
];

/**
 * `GET /api/dashboard`: agregação equivalente à da API sobre os mocks, mais os
 * campos PROPOSTOS `etapas` (média e faixa de espera) e `finalizados_hoje`.
 * A faixa "atencao" para Aguardando recurso é uma definição SIMULADA.
 */
export function montarDashboardMock(): DashboardProposto {
  const contar = <T extends { estado: string }>(itens: T[]) => ({
    LIVRE: itens.filter((i) => i.estado === "LIVRE").length,
    DISPONIVEL: itens.filter((i) => i.estado === "DISPONIVEL").length,
    OCUPADO: itens.filter((i) => i.estado === "OCUPADO").length,
    EM_MANUTENCAO: itens.filter((i) => i.estado === "EM_MANUTENCAO").length,
  });
  const por_estado = Object.fromEntries(
    ESTADOS.map((e) => [e, MOCK_OPERACOES.filter((o) => o.estado === e).length]),
  ) as DashboardProposto["por_estado"];
  const etapas: EtapaFluxo[] = ESTADOS.map((estado) => ({
    estado,
    quantidade: por_estado[estado],
    media_minutos: MOCK_TEMPOS.media_por_etapa_minutos[estado] ?? null,
    faixa_espera: estado === "AGUARDANDO_RECURSO" ? "atencao" : "normal",
  }));
  return {
    total_operacoes: MOCK_OPERACOES.length,
    por_estado,
    recursos: { vagas: contar(V), docas: contar(D), equipamentos: contar(E) },
    etapas,
    finalizados_hoje: por_estado.FINALIZADO,
  };
}
