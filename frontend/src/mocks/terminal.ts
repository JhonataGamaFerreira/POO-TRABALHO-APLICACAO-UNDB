/**
 * DADOS SIMULADOS. Nada aqui vem do backend nem está atualizado em tempo real.
 *
 * Os objetos seguem o contrato de `api.py` (ver src/types/terminal.ts) e o
 * cenário respeita as regras do domínio em `backend` (commit b16a874):
 *  - cada caminhão em operação ocupa vaga + doca + equipamento;
 *  - operação interrompida volta para AGUARDANDO_RECURSO e mantém a vaga;
 *  - equipamento quebrado fica EM_MANUTENCAO e gera ocorrência;
 *  - carga perigosa e refrigerada só estão em área compatível.
 * Instante de referência fixo (não depende do relógio da máquina).
 */
import type {
  Area,
  Caminhao,
  Carga,
  CaracteristicaCarga,
  Doca,
  DashboardResumo,
  Equipamento,
  EstadoCaminhao,
  EventoHistorico,
  ItemFila,
  Ocorrencia,
  OcorrenciaListada,
  Operacao,
  RelatorioTempos,
  Recursos,
  TipoOperacao,
  Vaga,
  AcaoOperacao,
} from "@/types/terminal";

export const MOCK_AGORA = "2026-11-06T14:35:00-03:00";
const T0 = Date.parse(MOCK_AGORA);
const atras = (min: number) => new Date(T0 - min * 60_000).toISOString();
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const RESPONSAVEL = uid(801);

/* ---------- Áreas, vagas, docas, equipamentos ---------- */

const area = (
  n: number,
  nome: string,
  extra: Partial<Area> = {},
): Area => ({
  id: uid(100 + n),
  nome,
  autorizada_carga_perigosa: false,
  refrigerada: false,
  interditada: false,
  ...extra,
});

const AREA_GERAL = area(1, "Área Geral");
const AREA_REFRIGERADA = area(2, "Área Refrigerada", { refrigerada: true });
const AREA_PERIGOSOS = area(3, "Área Perigosos", {
  autorizada_carga_perigosa: true,
});
const AREA_NORTE = area(4, "Área Norte", { interditada: true });
export const MOCK_AREAS: Area[] = [
  AREA_GERAL,
  AREA_REFRIGERADA,
  AREA_PERIGOSOS,
  AREA_NORTE,
];

const vaga = (n: number, a: Area): Vaga => ({
  id: uid(200 + n),
  area: a,
  estado: "LIVRE",
  operacao_id: null,
});
const doca = (n: number, a: Area): Doca => ({
  id: uid(300 + n),
  area: a,
  tipo: null,
  estado: "LIVRE",
  operacao_id: null,
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
  vaga(8, AREA_GERAL), vaga(9, AREA_GERAL), vaga(10, AREA_GERAL),
  vaga(11, AREA_REFRIGERADA), vaga(12, AREA_NORTE),
];
const D = [
  doca(1, AREA_GERAL), doca(2, AREA_GERAL), doca(3, AREA_REFRIGERADA),
  doca(4, AREA_REFRIGERADA), doca(5, AREA_GERAL), doca(6, AREA_GERAL),
  doca(7, AREA_NORTE), doca(8, AREA_NORTE),
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
  vaga?: Vaga;
  doca?: Doca;
  equipamento?: Equipamento;
  iniciadaMin?: number;
  finalizadaMin?: number;
  regular?: boolean;
  ocorrencias?: Ocorrencia[];
}

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

function operacao(e: EntradaOperacao): Operacao {
  const caminhao: Caminhao = {
    id: uid(600 + e.n),
    placa: e.placa,
    motorista: { id: uid(650 + e.n), nome: e.motorista, documento: `DOC-${e.n}0${e.n}` },
    transportadora: { id: uid(670 + e.n), nome: e.transportadora },
  };
  const carga: Carga = { descricao: e.carga, caracteristicas: e.caracteristicas };
  const opId = uid(500 + e.n);

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
  ocorrencias.forEach((o, i) =>
    historico.push({
      id: uid(950 + e.n * 10 + i),
      tipo: "OCORRENCIA",
      ocorrido_em: o.criada_em,
      responsavel_id: RESPONSAVEL,
      descricao: o.descricao,
      estado_anterior: null,
      estado_novo: null,
    }),
  );
  historico.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));

  const espera = e.chegadaMin - (e.iniciadaMin ?? 0);
  const operacaoMin =
    e.iniciadaMin !== undefined ? e.iniciadaMin - (e.finalizadaMin ?? 0) : 0;

  if (e.vaga) { e.vaga.estado = "OCUPADO"; e.vaga.operacao_id = opId; }
  if (e.doca) { e.doca.estado = "OCUPADO"; e.doca.operacao_id = opId; }
  if (e.equipamento) { e.equipamento.estado = "OCUPADO"; e.equipamento.operacao_id = opId; }

  return {
    id: opId,
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
    acoes_permitidas: ACOES[e.estado],
    tempos_minutos: { espera, operacao: operacaoMin },
  };
}

/* Ocorrências (3 abertas e 1 resolvida) */
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
  descricao: "Operador ausente; operação de VWX-3C33 interrompida na doca D3.",
  criada_em: atras(38),
  estado: "ABERTA",
  severidade: "media",
  impacto: "operacao",
  recurso_tipo: "doca",
  recurso_id: D[2].id,
});
const OC_DOC = ocorrencia(3, {
  tipo: "DOCUMENTACAO_IRREGULAR",
  descricao: "Documentação irregular na chegada.",
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

export const MOCK_OPERACOES: Operacao[] = [
  operacao({
    n: 1, placa: "ABC-1D23", motorista: "Carlos Mendes", transportadora: "TransNorte",
    carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
    estado: "AGUARDANDO_DOCUMENTACAO", chegadaMin: 40, regular: false,
    ocorrencias: [OC_DOC],
  }),
  operacao({
    n: 2, placa: "DEF-2E34", motorista: "Rita Souza", transportadora: "LogMar",
    carga: "Café em grãos", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_INSPECAO", chegadaMin: 30, inicial: "AGUARDANDO_INSPECAO",
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
    carga: "Eletroeletrônicos", caracteristicas: ["frágil"], tipo: "descarga",
    estado: "NO_PATIO", chegadaMin: 35, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[30, "NO_PATIO"]], vaga: V[0],
  }),
  operacao({
    n: 6, placa: "TPN-3E58", motorista: "Marta Reis", transportadora: "Rota Sul",
    carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "carga",
    estado: "NO_PATIO", chegadaMin: 12, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[8, "NO_PATIO"]], vaga: V[1],
  }),
  operacao({
    n: 7, placa: "FGH-2J34", motorista: "Edson Cruz", transportadora: "QuimTrans",
    carga: "Solvente industrial (classe 3)", caracteristicas: ["perigosa", "prioritária"],
    tipo: "descarga", estado: "AGUARDANDO_RECURSO", chegadaMin: 112,
    inicial: "AGUARDANDO_ENTRADA", vaga: V[4], iniciadaMin: 95,
    percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [95, "EM_OPERACAO"], [90, "AGUARDANDO_RECURSO"]],
    ocorrencias: [OC_EQ02],
  }),
  operacao({
    n: 8, placa: "KLM-8P12", motorista: "Lúcia Ferraz", transportadora: "FrioSul",
    carga: "Carne bovina congelada", caracteristicas: ["refrigerada"], tipo: "carga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 80, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[70, "NO_PATIO"], [60, "AGUARDANDO_RECURSO"]], vaga: V[5],
  }),
  operacao({
    n: 9, placa: "VWX-3C33", motorista: "Davi Nunes", transportadora: "AgroLog",
    carga: "Fertilizante a granel", caracteristicas: ["comum"], tipo: "descarga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 95, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[90, "NO_PATIO"], [85, "AGUARDANDO_RECURSO"], [80, "EM_OPERACAO"], [38, "AGUARDANDO_RECURSO"]],
    vaga: V[7], iniciadaMin: 80, ocorrencias: [OC_OPERADOR],
  }),
  operacao({
    n: 10, placa: "BRA-5C67", motorista: "Nilton Gomes", transportadora: "AgroLog",
    carga: "Milho a granel", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_RECURSO", chegadaMin: 48, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[44, "NO_PATIO"], [40, "AGUARDANDO_RECURSO"]], vaga: V[6],
  }),
  operacao({
    n: 11, placa: "PQR-1A11", motorista: "Sílvio Rocha", transportadora: "TransNorte",
    carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
    estado: "EM_OPERACAO", chegadaMin: 160, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[150, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [42, "EM_OPERACAO"]],
    vaga: V[2], doca: D[0], equipamento: EQ01, iniciadaMin: 42,
  }),
  operacao({
    n: 12, placa: "STU-2B22", motorista: "Olívia Dias", transportadora: "LogMar",
    carga: "Veículos (frágil)", caracteristicas: ["frágil"], tipo: "carga",
    estado: "EM_OPERACAO", chegadaMin: 70, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[65, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [15, "EM_OPERACAO"]],
    vaga: V[3], doca: D[1], equipamento: EQ04, iniciadaMin: 15,
  }),
  operacao({
    n: 13, placa: "CDE-4D44", motorista: "Heitor Lins", transportadora: "Rota Sul",
    carga: "Soja a granel", caracteristicas: ["comum"], tipo: "carga",
    estado: "EM_OPERACAO", chegadaMin: 190, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[180, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [65, "EM_OPERACAO"]],
    vaga: V[8], doca: D[4], equipamento: EQ05, iniciadaMin: 65,
  }),
  operacao({
    n: 14, placa: "GHI-5E55", motorista: "Teresa Boaventura", transportadora: "TransNorte",
    carga: "Contêineres 40' secos", caracteristicas: ["comum"], tipo: "descarga",
    estado: "EM_OPERACAO", chegadaMin: 60, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[55, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [20, "EM_OPERACAO"]],
    vaga: V[9], doca: D[5], equipamento: EQ06, iniciadaMin: 20,
  }),
  operacao({
    n: 15, placa: "JKL-7G45", motorista: "Rui Tavares", transportadora: "LogMar",
    carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "carga",
    estado: "AGUARDANDO_LIBERACAO", chegadaMin: 150, inicial: "AGUARDANDO_ENTRADA",
    percurso: [[140, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [100, "EM_OPERACAO"], [10, "AGUARDANDO_LIBERACAO"]],
    iniciadaMin: 100, finalizadaMin: 10,
  }),
  ...[16, 17, 18].map((n, i) =>
    operacao({
      n, placa: ["MNO-6F66", "PRS-3A77", "TUV-8B88"][i], motorista: "Motorista " + n,
      transportadora: "LogMar", carga: "Carga geral", caracteristicas: ["comum"],
      tipo: "carga", estado: "FINALIZADO", chegadaMin: 400 + i * 20,
      inicial: "AGUARDANDO_ENTRADA",
      percurso: [[390, "NO_PATIO"], [350, "AGUARDANDO_RECURSO"], [320, "EM_OPERACAO"], [200, "AGUARDANDO_LIBERACAO"], [190, "FINALIZADO"]],
      iniciadaMin: 320, finalizadaMin: 200,
      ocorrencias: i === 0 ? [OC_RESOLVIDA] : [],
    }),
  ),
];

export const MOCK_RECURSOS: Recursos = { vagas: V, docas: D, equipamentos: E };

/** `GET /api/occurrences`: um item por ocorrência, com a operação de origem. */
export const MOCK_OCORRENCIAS: OcorrenciaListada[] = MOCK_OPERACOES.flatMap((op) =>
  op.ocorrencias.map((o) => ({ operacao_id: op.id, ...o })),
);

/**
 * `GET /api/queue`. Ordem, posição e pontuação são SIMULADAS: valores
 * calculados à mão com a política padrão de `api.py` (prioritária 100,
 * perigosa 50, refrigerada 30, frágil 20, bônus de 0,5 por minuto). O front-end
 * não recalcula nem reordena.
 */
const P = { "prioritária": 100, perigosa: 50, refrigerada: 30, "frágil": 20, comum: 0 } as const;
const BONUS = 0.5;
function itemFila(
  posicao: number,
  placa: string,
  pontuacao: number,
  espera: number,
): ItemFila {
  const op = MOCK_OPERACOES.find((o) => o.caminhao.placa === placa)!;
  return {
    operacao_id: op.id,
    placa,
    carga: op.carga,
    estado: op.estado,
    posicao,
    espera_minutos: espera,
    pontuacao,
    fatores: [
      ...[...op.carga.caracteristicas]
        .sort((a, b) => a.localeCompare(b))
        .map((c) => ({ tipo: "caracteristica" as const, caracteristica: c, peso: P[c] })),
      { tipo: "tempo_espera" as const, minutos: espera, bonus_por_minuto: BONUS, pontos: espera * BONUS },
    ],
  };
}
export const MOCK_FILA: ItemFila[] = [
  itemFila(1, "FGH-2J34", 206, 112),
  itemFila(2, "KLM-8P12", 70, 80),
  itemFila(3, "VWX-3C33", 47.5, 95),
  itemFila(4, "RIO-9D01", 37.5, 35),
  itemFila(5, "BRA-5C67", 24, 48),
  itemFila(6, "TPN-3E58", 6, 12),
  itemFila(7, "UVW-1H22", 4.5, 9),
  itemFila(8, "XYZ-2J33", 2, 4),
];

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

/** `GET /api/dashboard`: agregação equivalente à da API sobre os mocks. */
export function montarDashboardMock(): DashboardResumo {
  const estados: EstadoCaminhao[] = [
    "AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "NO_PATIO",
    "AGUARDANDO_RECURSO", "EM_OPERACAO", "AGUARDANDO_LIBERACAO", "FINALIZADO",
  ];
  const contar = <T extends { estado: string }>(itens: T[]) => ({
    LIVRE: itens.filter((i) => i.estado === "LIVRE").length,
    DISPONIVEL: itens.filter((i) => i.estado === "DISPONIVEL").length,
    OCUPADO: itens.filter((i) => i.estado === "OCUPADO").length,
    EM_MANUTENCAO: itens.filter((i) => i.estado === "EM_MANUTENCAO").length,
  });
  return {
    total_operacoes: MOCK_OPERACOES.length,
    por_estado: Object.fromEntries(
      estados.map((e) => [e, MOCK_OPERACOES.filter((o) => o.estado === e).length]),
    ) as DashboardResumo["por_estado"],
    recursos: {
      vagas: contar(V),
      docas: contar(D),
      equipamentos: contar(E),
    },
  };
}
