/**
 * Cenário inicial do terminal (dados de demonstração), no formato normalizado
 * do motor de domínio (`src/domain`).
 *
 * Todos os instantes são calculados a partir de `agora` (relógio real do
 * momento em que o cenário é criado ou restaurado). Os tempos relativos são os
 * do cenário aprovado nos wireframes: a mesma chegada "há 112 min", "há 80 min"
 * etc., deslocada para o presente.
 *
 * O cenário respeita as regras do back-end (verificado por
 * `verificarInvariantes` em `src/domain/cenario.test.ts`):
 *  - operação em andamento ocupa vaga, doca e equipamento;
 *  - operação aguardando liberação não ocupa recurso algum;
 *  - operação aguardando recurso mantém a vaga do pátio;
 *  - carga perigosa/refrigerada só em área compatível.
 * A composição visual (história dos wireframes A1–B3) é preservada: EQ-02
 * quebrado afeta dois caminhões; D3 com operação interrompida; D4 em
 * manutenção; V09 em área interditada; D7 livre sem equipamento compatível.
 */
import type {
  CaracteristicaCarga,
  EstadoCaminhao,
  EventoHistorico,
  TipoOperacao,
} from "@/types/terminal";
import type {
  AreaE,
  DocaE,
  EquipamentoE,
  EstadoTerminal,
  Funcionario,
  OcorrenciaE,
  OperacaoE,
  VagaE,
} from "@/domain/tipos";
import { VERSAO_ESQUEMA } from "@/domain/tipos";
import { POLITICA_PADRAO } from "@/domain/regras";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const opId = (n: number) => uid(500 + n);

/** Funcionários fixos (sem login): um por função exigida pelas regras. */
export const FUNCIONARIOS: Funcionario[] = [
  { id: uid(801), nome: "Marina Costa", funcao: "RECEPCAO", habilitacoes: [] },
  { id: uid(802), nome: "Rogério Alves", funcao: "INSPETOR", habilitacoes: [] },
  { id: uid(803), nome: "Luciana Prado", funcao: "OPERADOR", habilitacoes: ["carga", "descarga"] },
  { id: uid(804), nome: "Carlos Reis", funcao: "SUPERVISOR", habilitacoes: [] },
];
const [RECEPCAO, INSPETOR, OPERADOR, SUPERVISOR] = FUNCIONARIOS;

/** Quem executa a transição para cada estado (mesmos papéis usados pelo motor). */
const RESPONSAVEL_DO_DESTINO: Record<EstadoCaminhao, Funcionario> = {
  AGUARDANDO_DOCUMENTACAO: RECEPCAO,
  AGUARDANDO_INSPECAO: RECEPCAO,
  AGUARDANDO_ENTRADA: RECEPCAO,
  NO_PATIO: RECEPCAO,
  AGUARDANDO_RECURSO: OPERADOR,
  EM_OPERACAO: OPERADOR,
  AGUARDANDO_LIBERACAO: OPERADOR,
  FINALIZADO: RECEPCAO,
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
  inicial?: EstadoCaminhao;
  /** Transições após a chegada: [minutos atrás, estado novo]. */
  percurso?: Array<[number, EstadoCaminhao]>;
  vaga?: string;
  doca?: string;
  equipamento?: string;
  iniciadaMin?: number;
  finalizadaMin?: number;
  estimativaMin?: number;
  regular?: boolean;
}

export function criarCenarioInicial(agora: Date): EstadoTerminal {
  const T0 = agora.getTime();
  const atras = (min: number) => new Date(T0 - min * 60_000).toISOString();
  const depois = (min: number) => new Date(T0 + min * 60_000).toISOString();

  /* ---------- Áreas, vagas, docas, equipamentos ---------- */
  const area = (n: number, nome: string, extra: Partial<AreaE> = {}): AreaE => ({
    id: uid(100 + n), nome, autorizada_carga_perigosa: false, refrigerada: false,
    interditada: false, motivo_interdicao: null, ...extra,
  });
  const GERAL = area(1, "Área Geral");
  const REFRIGERADA = area(2, "Área Refrigerada", { refrigerada: true });
  const PERIGOSOS = area(3, "Área Perigosos", { autorizada_carga_perigosa: true });
  const NORTE = area(4, "Área Norte", { interditada: true, motivo_interdicao: "piso danificado" });
  const areas = [GERAL, REFRIGERADA, PERIGOSOS, NORTE];

  const vaga = (n: number, a: AreaE): VagaE => ({
    id: uid(200 + n), codigo: `V${String(n).padStart(2, "0")}`, area_id: a.id,
    estado: "LIVRE", operacao_id: null,
  });
  // V01–V12 como nos wireframes (V09 na área interditada); V13–V18 completam a capacidade
  // necessária para que as 5 operações em andamento tenham vaga, como exige o back-end.
  const vagas: VagaE[] = [
    vaga(1, GERAL), vaga(2, GERAL), vaga(3, GERAL), vaga(4, GERAL),
    vaga(5, PERIGOSOS), vaga(6, REFRIGERADA), vaga(7, GERAL), vaga(8, GERAL),
    vaga(9, NORTE), vaga(10, GERAL), vaga(11, GERAL), vaga(12, GERAL),
    vaga(13, GERAL), vaga(14, GERAL), vaga(15, GERAL), vaga(16, GERAL),
    vaga(17, GERAL), vaga(18, GERAL),
  ];

  const doca = (n: number, a: AreaE): DocaE => ({
    id: uid(300 + n), codigo: `D${n}`, area_id: a.id, tipo: null,
    estado: "LIVRE", operacao_id: null, manutencao_ate: null,
  });
  const docas: DocaE[] = [
    doca(1, PERIGOSOS), doca(2, GERAL), doca(3, GERAL), doca(4, REFRIGERADA),
    doca(5, GERAL), doca(6, PERIGOSOS), doca(7, PERIGOSOS), doca(8, GERAL),
  ];

  const equip = (n: number, fragil = false): EquipamentoE => ({
    id: uid(400 + n), nome: `EQ-${String(n).padStart(2, "0")}`,
    tipos_compativeis: ["carga", "descarga"], aceita_carga_fragil: fragil,
    estado: "DISPONIVEL", operacao_id: null,
  });
  const equipamentos: EquipamentoE[] = [equip(1), equip(2), equip(3), equip(4, true), equip(5), equip(6)];

  const porCodigoVaga = (c: string) => vagas.find((v) => v.codigo === c)!;
  const porCodigoDoca = (c: string) => docas.find((d) => d.codigo === c)!;
  const porNomeEquip = (n: string) => equipamentos.find((q) => q.nome === n)!;

  const D3 = porCodigoDoca("D3");
  const EQ02 = porNomeEquip("EQ-02");
  docas[3].estado = "EM_MANUTENCAO"; // D4 em manutenção
  docas[3].manutencao_ate = depois(115);
  EQ02.estado = "EM_MANUTENCAO"; // EQ-02 quebrado (ocorrência 1)

  /* ---------- Ocorrências ---------- */
  const ocorrencias: OcorrenciaE[] = [
    {
      id: uid(701), tipo: "EQUIPAMENTO_QUEBRADO", descricao: "EQ-02 quebrada durante a operação de FGH-2J34.",
      responsavel_id: OPERADOR.id, criada_em: atras(90), estado: "ABERTA", resolvida_em: null, resolvida_por: null,
      severidade: "critica", impacto: "recurso", recurso_tipo: "equipment", recurso_id: EQ02.id,
      operacao_id: opId(6), titulo: "EQ-02 quebrada",
      operacoes_afetadas: [
        { operacao_id: opId(6), severidade: "critica" },
        { operacao_id: opId(9), severidade: "media" },
      ],
      metrica_rotulo: "espera máxima",
    },
    {
      id: uid(702), tipo: "ATRASO", descricao: "Descarga de VWX-3C33 interrompida (58 de 90 min estimados).",
      responsavel_id: OPERADOR.id, criada_em: atras(38), estado: "ABERTA", resolvida_em: null, resolvida_por: null,
      severidade: "media", impacto: "operacao", recurso_tipo: "doca", recurso_id: D3.id,
      operacao_id: opId(10), titulo: "D3 interrompida · operador ausente",
      operacoes_afetadas: [{ operacao_id: opId(10), severidade: "media" }],
      metrica_rotulo: "parada",
    },
    {
      id: uid(703), tipo: "DOCUMENTACAO_IRREGULAR", descricao: "Pré-entrada, retido na etapa Documentação.",
      responsavel_id: RECEPCAO.id, criada_em: atras(25), estado: "ABERTA", resolvida_em: null, resolvida_por: null,
      severidade: "media", impacto: "operacao", recurso_tipo: null, recurso_id: null,
      operacao_id: opId(1), titulo: "ABC-1D23 · documentação irregular",
      operacoes_afetadas: [{ operacao_id: opId(1), severidade: "media" }],
      metrica_rotulo: "na etapa",
    },
    {
      id: uid(704), tipo: "ATRASO", descricao: "Atraso na inspeção de MNO-6F66.",
      responsavel_id: INSPETOR.id, criada_em: atras(300), estado: "RESOLVIDA", resolvida_em: atras(280),
      resolvida_por: SUPERVISOR.id, severidade: "baixa", impacto: "operacao", recurso_tipo: null, recurso_id: null,
      operacao_id: opId(16), titulo: "MNO-6F66 · atraso na inspeção",
      operacoes_afetadas: [{ operacao_id: opId(16), severidade: "baixa" }],
      metrica_rotulo: null,
    },
  ];

  /* ---------- Operações ---------- */
  const operacao = (e: EntradaOperacao): OperacaoE => {
    const id = opId(e.n);
    let anterior: EstadoCaminhao = e.inicial ?? "AGUARDANDO_DOCUMENTACAO";
    const historico: EventoHistorico[] = (e.percurso ?? []).map(([min, novo], i) => {
      const ev: EventoHistorico = {
        id: uid(900 + e.n * 10 + i), tipo: "MUDANCA_ESTADO", ocorrido_em: atras(min),
        responsavel_id: RESPONSAVEL_DO_DESTINO[novo].id, descricao: `Estado alterado para ${novo}.`,
        estado_anterior: anterior, estado_novo: novo,
      };
      anterior = novo;
      return ev;
    });
    ocorrencias.filter((o) => o.operacao_id === id).forEach((o, i) => {
      historico.push({
        id: uid(950 + e.n * 10 + i), tipo: "OCORRENCIA", ocorrido_em: o.criada_em,
        responsavel_id: o.responsavel_id, descricao: o.descricao, estado_anterior: null, estado_novo: null,
      });
    });
    historico.sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));

    const v = e.vaga ? porCodigoVaga(e.vaga) : null;
    const d = e.doca ? porCodigoDoca(e.doca) : null;
    const q = e.equipamento ? porNomeEquip(e.equipamento) : null;
    for (const r of [v, d, q]) if (r) { r.estado = "OCUPADO"; r.operacao_id = id; }

    return {
      id,
      caminhao: {
        id: uid(600 + e.n), placa: e.placa,
        motorista: { id: uid(650 + e.n), nome: e.motorista, documento: `DOC-${e.n}0${e.n}` },
        transportadora: { id: uid(2000 + e.n), nome: e.transportadora },
      },
      carga: { descricao: e.carga, caracteristicas: e.caracteristicas },
      tipo: e.tipo,
      chegada_em: atras(e.chegadaMin),
      estado: e.estado,
      documentacao_regular: e.regular ?? true,
      vaga_id: v?.id ?? null,
      doca_id: d?.id ?? null,
      equipamento_id: q?.id ?? null,
      funcionario_responsavel_id: (historico.at(-1)
        ? historico.filter((h) => h.tipo === "MUDANCA_ESTADO").at(-1)?.responsavel_id
        : null) ?? null,
      iniciada_em: e.iniciadaMin !== undefined ? atras(e.iniciadaMin) : null,
      finalizada_em: e.finalizadaMin !== undefined ? atras(e.finalizadaMin) : null,
      cancelada: false,
      motivo_cancelamento: null,
      historico,
      inspecoes: [],
      duracao_estimada_minutos: e.estimativaMin ?? null,
      interrupcao: null,
    };
  };

  const operacoes: OperacaoE[] = [
    operacao({ n: 1, placa: "ABC-1D23", motorista: "Carlos Mendes", transportadora: "TransNorte",
      carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
      estado: "AGUARDANDO_DOCUMENTACAO", chegadaMin: 25, regular: false }),
    operacao({ n: 2, placa: "DEF-2E34", motorista: "Rita Souza", transportadora: "LogMar",
      carga: "Café em grãos", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_INSPECAO", chegadaMin: 30, inicial: "AGUARDANDO_DOCUMENTACAO",
      percurso: [[10, "AGUARDANDO_INSPECAO"]] }),
    operacao({ n: 3, placa: "UVW-1H22", motorista: "Paulo Lima", transportadora: "TransNorte",
      carga: "Contêiner 20' seco", caracteristicas: ["comum"], tipo: "descarga",
      estado: "AGUARDANDO_ENTRADA", chegadaMin: 9, inicial: "AGUARDANDO_ENTRADA" }),
    operacao({ n: 4, placa: "XYZ-2J33", motorista: "Ana Prado", transportadora: "Rota Sul",
      carga: "Máquinas agrícolas", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_ENTRADA", chegadaMin: 4, inicial: "AGUARDANDO_ENTRADA" }),
    operacao({ n: 5, placa: "RIO-9D01", motorista: "Jonas Alves", transportadora: "LogMar",
      carga: "Eletroeletrônicos", caracteristicas: ["comum"], tipo: "descarga",
      estado: "NO_PATIO", chegadaMin: 35, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[30, "NO_PATIO"]], vaga: "V01" }),
    operacao({ n: 19, placa: "TPN-3E58", motorista: "Marta Veloso", transportadora: "AgroLog",
      carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "descarga",
      estado: "NO_PATIO", chegadaMin: 12, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[8, "NO_PATIO"]], vaga: "V02" }),
    operacao({ n: 6, placa: "FGH-2J34", motorista: "Edson Cruz", transportadora: "QuimTrans",
      carga: "Solvente industrial (classe 3)", caracteristicas: ["perigosa", "prioritária"],
      tipo: "descarga", estado: "AGUARDANDO_RECURSO", chegadaMin: 112, inicial: "AGUARDANDO_ENTRADA",
      vaga: "V05", iniciadaMin: 95,
      percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [95, "EM_OPERACAO"], [90, "AGUARDANDO_RECURSO"]] }),
    operacao({ n: 7, placa: "KLM-8P12", motorista: "Lúcia Ferraz", transportadora: "FrioSul",
      carga: "Carne bovina congelada", caracteristicas: ["refrigerada"], tipo: "carga",
      estado: "AGUARDANDO_RECURSO", chegadaMin: 80, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[70, "NO_PATIO"], [60, "AGUARDANDO_RECURSO"]], vaga: "V06" }),
    operacao({ n: 8, placa: "BRA-5C67", motorista: "Nilton Gomes", transportadora: "AgroLog",
      carga: "Milho a granel", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_RECURSO", chegadaMin: 48, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[44, "NO_PATIO"], [40, "AGUARDANDO_RECURSO"]], vaga: "V07" }),
    operacao({ n: 9, placa: "NOP-6F90", motorista: "Sônia Ribeiro", transportadora: "Rota Sul",
      carga: "Carga geral paletizada", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_RECURSO", chegadaMin: 41, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[38, "NO_PATIO"], [35, "AGUARDANDO_RECURSO"]], vaga: "V08" }),
    operacao({ n: 10, placa: "VWX-3C33", motorista: "Davi Nunes", transportadora: "AgroLog",
      carga: "Fertilizante a granel", caracteristicas: ["comum"], tipo: "descarga",
      estado: "AGUARDANDO_RECURSO", chegadaMin: 110, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [96, "EM_OPERACAO"], [38, "AGUARDANDO_RECURSO"]],
      vaga: "V03", iniciadaMin: 96, estimativaMin: 90 }),
    operacao({ n: 11, placa: "PQR-1A11", motorista: "Sílvio Rocha", transportadora: "TransNorte",
      carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
      estado: "EM_OPERACAO", chegadaMin: 160, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[150, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [42, "EM_OPERACAO"]],
      vaga: "V04", doca: "D1", equipamento: "EQ-01", iniciadaMin: 42, estimativaMin: 70 }),
    operacao({ n: 12, placa: "STU-2B22", motorista: "Olívia Dias", transportadora: "LogMar",
      carga: "Veículos (frágil)", caracteristicas: ["frágil"], tipo: "carga",
      estado: "EM_OPERACAO", chegadaMin: 70, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[65, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [15, "EM_OPERACAO"]],
      vaga: "V10", doca: "D2", equipamento: "EQ-04", iniciadaMin: 15, estimativaMin: 60 }),
    operacao({ n: 13, placa: "CDE-4D44", motorista: "Heitor Lins", transportadora: "Rota Sul",
      carga: "Soja a granel", caracteristicas: ["comum"], tipo: "carga",
      estado: "EM_OPERACAO", chegadaMin: 190, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[180, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [65, "EM_OPERACAO"]],
      vaga: "V11", doca: "D5", equipamento: "EQ-03", iniciadaMin: 65, estimativaMin: 90 }),
    operacao({ n: 14, placa: "GHI-5E55", motorista: "Teresa Boaventura", transportadora: "TransNorte",
      carga: "Contêineres 40' secos", caracteristicas: ["comum"], tipo: "descarga",
      estado: "EM_OPERACAO", chegadaMin: 60, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[55, "NO_PATIO"], [30, "AGUARDANDO_RECURSO"], [20, "EM_OPERACAO"]],
      vaga: "V12", doca: "D6", equipamento: "EQ-05", iniciadaMin: 20, estimativaMin: 45 }),
    operacao({ n: 15, placa: "JKL-7G45", motorista: "Rui Tavares", transportadora: "LogMar",
      carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_LIBERACAO", chegadaMin: 150, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[140, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [100, "EM_OPERACAO"], [10, "AGUARDANDO_LIBERACAO"]],
      iniciadaMin: 100, finalizadaMin: 10 }),
    operacao({ n: 16, placa: "MNO-6F66", motorista: "Heloísa Pinto", transportadora: "LogMar",
      carga: "Carga geral", caracteristicas: ["comum"], tipo: "carga",
      estado: "EM_OPERACAO", chegadaMin: 90, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[85, "NO_PATIO"], [40, "AGUARDANDO_RECURSO"], [5, "EM_OPERACAO"]],
      vaga: "V13", doca: "D8", equipamento: "EQ-06", iniciadaMin: 5, estimativaMin: 60 }),
    // Finalizados no dia (23; os 17 ativos ficam fora desta conta).
    ...Array.from({ length: 23 }, (_, i) => {
      const n = i < 2 ? 17 + i : 18 + i; // 17, 18, 20…40 (19 é TPN-3E58)
      const letras = "ABCDEFGHJKLMNPRSTUVWXYZ";
      const placa = `${letras[(i * 3) % letras.length]}${letras[(i * 5 + 2) % letras.length]}${letras[(i * 7 + 4) % letras.length]}-${(i % 9) + 1}${letras[(i * 2 + 1) % letras.length]}${(i * 3) % 10}${(i * 7) % 10}`;
      return operacao({
        n, placa, motorista: `Motorista ${n}`,
        transportadora: ["LogMar", "TransNorte", "Rota Sul", "AgroLog"][i % 4],
        carga: "Carga geral", caracteristicas: ["comum"], tipo: i % 2 ? "descarga" : "carga",
        estado: "FINALIZADO", chegadaMin: 420 + i * 20, inicial: "AGUARDANDO_ENTRADA",
        percurso: [[410 + i * 20, "NO_PATIO"], [380 + i * 20, "AGUARDANDO_RECURSO"], [340 + i * 20, "EM_OPERACAO"], [220 + i * 20, "AGUARDANDO_LIBERACAO"], [210 + i * 20, "FINALIZADO"]],
        iniciadaMin: 340 + i * 20, finalizadaMin: 220 + i * 20,
      });
    }),
  ];

  // VWX-3C33: a descarga foi interrompida (operador ausente) na D3. Pelo ciclo de vida do
  // back-end, a doca e o equipamento foram liberados e a vaga foi mantida.
  const vwx = operacoes.find((o) => o.id === opId(10))!;
  vwx.interrupcao = {
    doca_id: D3.id, interrompida_em: atras(38), minutos_operados: 58, ocorrencia_id: uid(702),
  };

  return {
    versao: VERSAO_ESQUEMA,
    criado_em: agora.toISOString(),
    areas,
    vagas,
    docas,
    equipamentos,
    funcionarios: structuredClone(FUNCIONARIOS),
    operacoes,
    ocorrencias,
    politica: structuredClone(POLITICA_PADRAO),
    // Médias por etapa do cenário inicial (ilustrativas; não recalculadas).
    tempos: {
      media_espera_minutos: 58,
      media_operacao_minutos: 34,
      media_por_etapa_minutos: {
        AGUARDANDO_DOCUMENTACAO: 25, AGUARDANDO_INSPECAO: 10, AGUARDANDO_ENTRADA: 7,
        NO_PATIO: 24, AGUARDANDO_RECURSO: 70, EM_OPERACAO: 34, AGUARDANDO_LIBERACAO: 6,
      },
      amostras: { espera: 18, operacao: 8 },
    },
  };
}
