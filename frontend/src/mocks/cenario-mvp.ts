/**
 * Cenário reduzido de demonstração do MVP (`criarCenarioMvp`), no mesmo formato
 * normalizado do motor de domínio (`src/domain`).
 *
 * É uma configuração independente do cenário completo (`cenario.ts`, intocado):
 * nada aqui é compartilhado nem derivado dele, para que alterar um não afete o outro.
 *
 * Tamanho: 8 vagas, 3 docas, 3 equipamentos e 6 caminhões ativos (mais 3
 * finalizados, só para o contador "finalizados hoje"). Cada caminhão ativo está
 * em uma etapa diferente do ciclo, e a situação dos recursos conta uma história
 * só, fácil de acompanhar:
 *
 *  - ABC-1D23  aguardando documentação (documentação irregular: ocorrência de atenção);
 *  - DEF-2E34  aguardando inspeção;
 *  - RIO-9D01  no pátio (V01), na fila, sem equipamento disponível;
 *  - FGH-2J34  aguardando recurso, prioritária e perigosa (V05): a EQ-02 quebrou
 *              durante a operação, que foi interrompida na D3 (ocorrência crítica);
 *  - PQR-1A11  em operação (V04, D1, EQ-01);
 *  - JKL-7G45  aguardando liberação (operação concluída, sem recursos).
 *
 * Recursos: D1 ocupada, D2 livre, D3 livre com interrupção; EQ-01 em uso, EQ-02
 * quebrado, EQ-03 em manutenção (por isso nenhum equipamento está disponível e o
 * pátio mostra por que ninguém começa); V08 em área interditada.
 *
 * As mesmas regras do cenário completo valem aqui (`verificarInvariantes`, testado em
 * `src/domain/cenarios.test.ts`): operação em andamento ocupa vaga, doca e equipamento;
 * aguardando liberação não ocupa nada; aguardando recurso mantém a vaga; carga
 * perigosa/refrigerada só em área compatível; recurso em manutenção ou em área
 * interditada não aparece como livre nem ocupado por operação.
 *
 * Todos os instantes são calculados a partir de `agora` (relógio real do momento
 * em que o cenário é criado ou restaurado).
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
const FUNCIONARIOS_MVP: Funcionario[] = [
  { id: uid(801), nome: "Marina Costa", funcao: "RECEPCAO", habilitacoes: [] },
  { id: uid(802), nome: "Rogério Alves", funcao: "INSPETOR", habilitacoes: [] },
  { id: uid(803), nome: "Luciana Prado", funcao: "OPERADOR", habilitacoes: ["carga", "descarga"] },
  { id: uid(804), nome: "Carlos Reis", funcao: "SUPERVISOR", habilitacoes: [] },
];
const [RECEPCAO, , OPERADOR] = FUNCIONARIOS_MVP;

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

export function criarCenarioMvp(agora: Date): EstadoTerminal {
  const T0 = agora.getTime();
  const atras = (min: number) => new Date(T0 - min * 60_000).toISOString();

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
  // 8 vagas: pátio geral, uma para perigosos, uma refrigerada e uma em área interditada.
  const vagas: VagaE[] = [
    vaga(1, GERAL), vaga(2, GERAL), vaga(3, GERAL), vaga(4, GERAL),
    vaga(5, PERIGOSOS), vaga(6, REFRIGERADA), vaga(7, GERAL), vaga(8, NORTE),
  ];

  const doca = (n: number, a: AreaE): DocaE => ({
    id: uid(300 + n), codigo: `D${n}`, area_id: a.id, tipo: null,
    estado: "LIVRE", operacao_id: null, manutencao_ate: null,
  });
  // Uma doca de cada tipo de área: carga comum começa pela D1 e a D3 fica para a carga perigosa.
  const docas: DocaE[] = [doca(1, GERAL), doca(2, REFRIGERADA), doca(3, PERIGOSOS)];

  const equip = (n: number): EquipamentoE => ({
    id: uid(400 + n), nome: `EQ-${String(n).padStart(2, "0")}`,
    tipos_compativeis: ["carga", "descarga"], aceita_carga_fragil: false,
    estado: "DISPONIVEL", operacao_id: null,
  });
  const equipamentos: EquipamentoE[] = [equip(1), equip(2), equip(3)];

  const porCodigoVaga = (c: string) => vagas.find((v) => v.codigo === c)!;
  const porCodigoDoca = (c: string) => docas.find((d) => d.codigo === c)!;
  const porNomeEquip = (n: string) => equipamentos.find((q) => q.nome === n)!;

  const D3 = porCodigoDoca("D3");
  const EQ02 = porNomeEquip("EQ-02");
  EQ02.estado = "EM_MANUTENCAO"; // EQ-02 quebrado (ocorrência crítica abaixo)
  porNomeEquip("EQ-03").estado = "EM_MANUTENCAO"; // EQ-03 em manutenção (sem quebra)

  /* ---------- Ocorrências (abertas: 1 crítica e 1 de atenção) ---------- */
  const ocorrencias: OcorrenciaE[] = [
    {
      id: uid(701), tipo: "EQUIPAMENTO_QUEBRADO", descricao: "EQ-02 quebrada durante a operação de FGH-2J34.",
      responsavel_id: OPERADOR.id, criada_em: atras(90), estado: "ABERTA", resolvida_em: null, resolvida_por: null,
      severidade: "critica", impacto: "recurso", recurso_tipo: "equipment", recurso_id: EQ02.id,
      operacao_id: opId(4), titulo: "EQ-02 quebrada",
      operacoes_afetadas: [
        { operacao_id: opId(4), severidade: "critica" },
        { operacao_id: opId(3), severidade: "media" },
      ],
      metrica_rotulo: "espera máxima",
    },
    {
      id: uid(702), tipo: "DOCUMENTACAO_IRREGULAR", descricao: "Pré-entrada, retido na etapa Documentação.",
      responsavel_id: RECEPCAO.id, criada_em: atras(25), estado: "ABERTA", resolvida_em: null, resolvida_por: null,
      severidade: "media", impacto: "operacao", recurso_tipo: null, recurso_id: null,
      operacao_id: opId(1), titulo: "ABC-1D23 · documentação irregular",
      operacoes_afetadas: [{ operacao_id: opId(1), severidade: "media" }],
      metrica_rotulo: "na etapa",
    },
  ];

  /* ---------- Operações ---------- */
  const operacao = (e: EntradaOperacao): OperacaoE => {
    const id = opId(e.n);
    let anterior: EstadoCaminhao = e.inicial ?? "AGUARDANDO_DOCUMENTACAO";
    const historico: EventoHistorico[] = (e.percurso ?? []).map(([min, novo], i) => {
      const ev: EventoHistorico = {
        id: uid(1000 + e.n * 20 + i), tipo: "MUDANCA_ESTADO", ocorrido_em: atras(min),
        responsavel_id: RESPONSAVEL_DO_DESTINO[novo].id, descricao: `Estado alterado para ${novo}.`,
        estado_anterior: anterior, estado_novo: novo,
      };
      anterior = novo;
      return ev;
    });
    ocorrencias.filter((o) => o.operacao_id === id).forEach((o, i) => {
      historico.push({
        id: uid(1500 + e.n * 20 + i), tipo: "OCORRENCIA", ocorrido_em: o.criada_em,
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
      funcionario_responsavel_id:
        historico.filter((h) => h.tipo === "MUDANCA_ESTADO").at(-1)?.responsavel_id ?? null,
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
    // 1. Aguardando conferência documental.
    operacao({ n: 1, placa: "ABC-1D23", motorista: "Carlos Mendes", transportadora: "TransNorte",
      carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
      estado: "AGUARDANDO_DOCUMENTACAO", chegadaMin: 25, regular: false }),
    // 2. Aguardando inspeção.
    operacao({ n: 2, placa: "DEF-2E34", motorista: "Rita Souza", transportadora: "LogMar",
      carga: "Café em grãos", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_INSPECAO", chegadaMin: 30, inicial: "AGUARDANDO_DOCUMENTACAO",
      percurso: [[10, "AGUARDANDO_INSPECAO"]] }),
    // 3. Já admitido no pátio (vaga V01), esperando para começar.
    operacao({ n: 3, placa: "RIO-9D01", motorista: "Jonas Alves", transportadora: "LogMar",
      carga: "Eletroeletrônicos", caracteristicas: ["comum"], tipo: "descarga",
      estado: "NO_PATIO", chegadaMin: 35, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[30, "NO_PATIO"]], vaga: "V01" }),
    // 4. Na fila aguardando recursos: prioritária, operação interrompida na D3 pela quebra da EQ-02.
    operacao({ n: 4, placa: "FGH-2J34", motorista: "Edson Cruz", transportadora: "QuimTrans",
      carga: "Solvente industrial (classe 3)", caracteristicas: ["perigosa", "prioritária"],
      tipo: "descarga", estado: "AGUARDANDO_RECURSO", chegadaMin: 112, inicial: "AGUARDANDO_ENTRADA",
      vaga: "V05", iniciadaMin: 95, estimativaMin: 180,
      percurso: [[105, "NO_PATIO"], [100, "AGUARDANDO_RECURSO"], [95, "EM_OPERACAO"], [90, "AGUARDANDO_RECURSO"]] }),
    // 5. Em operação (vaga, doca e equipamento ocupados).
    operacao({ n: 5, placa: "PQR-1A11", motorista: "Sílvio Rocha", transportadora: "TransNorte",
      carga: "Fertilizante em sacaria", caracteristicas: ["comum"], tipo: "descarga",
      estado: "EM_OPERACAO", chegadaMin: 160, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[150, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [42, "EM_OPERACAO"]],
      vaga: "V04", doca: "D1", equipamento: "EQ-01", iniciadaMin: 42, estimativaMin: 70 }),
    // 6. Operação concluída, aguardando liberação (não ocupa recurso algum).
    operacao({ n: 6, placa: "JKL-7G45", motorista: "Rui Tavares", transportadora: "LogMar",
      carga: "Papel em bobinas", caracteristicas: ["comum"], tipo: "carga",
      estado: "AGUARDANDO_LIBERACAO", chegadaMin: 150, inicial: "AGUARDANDO_ENTRADA",
      percurso: [[140, "NO_PATIO"], [120, "AGUARDANDO_RECURSO"], [100, "EM_OPERACAO"], [10, "AGUARDANDO_LIBERACAO"]],
      iniciadaMin: 100, finalizadaMin: 10 }),
    // Finalizados no dia (fora dos 6 ativos): só alimentam o contador "finalizados hoje".
    ...([
      ["LMN-4K21", "Marcos Teles", "AgroLog", "Bobinas de aço", "descarga", 0],
      ["QRS-7M50", "Vera Campos", "Rota Sul", "Cimento ensacado", "carga", 1],
      ["TUV-3N88", "Otávio Lima", "TransNorte", "Grãos de soja", "descarga", 2],
    ] as const).map(([placa, motorista, transportadora, carga, tipo, i]) =>
      operacao({
        n: 7 + i, placa, motorista, transportadora, carga, caracteristicas: ["comum"], tipo,
        estado: "FINALIZADO", chegadaMin: 280 + i * 50, inicial: "AGUARDANDO_ENTRADA",
        percurso: [
          [270 + i * 50, "NO_PATIO"], [245 + i * 50, "AGUARDANDO_RECURSO"], [215 + i * 50, "EM_OPERACAO"],
          [130 + i * 50, "AGUARDANDO_LIBERACAO"], [120 + i * 50, "FINALIZADO"],
        ],
        iniciadaMin: 215 + i * 50, finalizadaMin: 130 + i * 50,
      }),
    ),
  ];

  // FGH-2J34: o mesmo que `interromper` faz com equipamento quebrado — doca e equipamento
  // liberados, vaga mantida e a doca de origem (D3) livre, marcada como interrompida.
  const fgh = operacoes.find((o) => o.id === opId(4))!;
  fgh.interrupcao = {
    doca_id: D3.id, interrompida_em: atras(90), minutos_operados: 5, ocorrencia_id: uid(701),
  };

  return {
    versao: VERSAO_ESQUEMA,
    criado_em: agora.toISOString(),
    areas,
    vagas,
    docas,
    equipamentos,
    funcionarios: structuredClone(FUNCIONARIOS_MVP),
    operacoes,
    ocorrencias,
    politica: structuredClone(POLITICA_PADRAO),
    // Médias por etapa do cenário de demonstração (ilustrativas; não recalculadas).
    tempos: {
      media_espera_minutos: 52,
      media_operacao_minutos: 38,
      media_por_etapa_minutos: {
        AGUARDANDO_DOCUMENTACAO: 25, AGUARDANDO_INSPECAO: 10, AGUARDANDO_ENTRADA: 7,
        NO_PATIO: 24, AGUARDANDO_RECURSO: 60, EM_OPERACAO: 38, AGUARDANDO_LIBERACAO: 6,
      },
      amostras: { espera: 3, operacao: 3 },
    },
  };
}
