/** Fábrica de cenários pequenos para os testes do motor (não é usada pela aplicação). */
import type { CaracteristicaCarga, EstadoCaminhao, TipoOperacao } from "@/types/terminal";
import { POLITICA_PADRAO } from "./regras";
import type { Contexto, EstadoTerminal, Funcionario, OperacaoE } from "./tipos";

export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const AGORA = new Date("2026-11-09T12:00:00.000Z");
export const atras = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();

export function contextoFixo(inicio = 9000): Contexto {
  let n = inicio;
  return { agora: AGORA, novoId: () => uid(n++) };
}

export const FUNC = {
  recepcao: { id: uid(801), nome: "Recepção", funcao: "RECEPCAO", habilitacoes: [] } as Funcionario,
  inspetor: { id: uid(802), nome: "Inspetor", funcao: "INSPETOR", habilitacoes: [] } as Funcionario,
  operador: { id: uid(803), nome: "Operador", funcao: "OPERADOR", habilitacoes: ["carga", "descarga"] } as Funcionario,
  supervisor: { id: uid(804), nome: "Supervisor", funcao: "SUPERVISOR", habilitacoes: [] } as Funcionario,
};

/**
 * Terminal mínimo: áreas geral/refrigerada/perigosos/interditada; 4 vagas gerais, 1 refrigerada,
 * 1 de perigosos, 1 interditada; docas D1 (geral), D2 (refrigerada), D3 (perigosos), D4 (carga);
 * equipamentos EQ-01 (comum), EQ-02 (aceita frágil).
 */
export function terminalBase(): EstadoTerminal {
  const area = (n: number, nome: string, extra = {}) => ({
    id: uid(100 + n), nome, autorizada_carga_perigosa: false, refrigerada: false,
    interditada: false, motivo_interdicao: null, ...extra,
  });
  const areas = [
    area(1, "Geral"),
    area(2, "Refrigerada", { refrigerada: true }),
    area(3, "Perigosos", { autorizada_carga_perigosa: true }),
    area(4, "Norte", { interditada: true, motivo_interdicao: "piso danificado" }),
  ];
  const vaga = (n: number, a: number) => ({
    id: uid(200 + n), codigo: `V${String(n).padStart(2, "0")}`, area_id: uid(100 + a),
    estado: "LIVRE" as const, operacao_id: null,
  });
  const doca = (n: number, a: number, tipo: TipoOperacao | null = null) => ({
    id: uid(300 + n), codigo: `D${n}`, area_id: uid(100 + a), tipo,
    estado: "LIVRE" as const, operacao_id: null, manutencao_ate: null,
  });
  const eq = (n: number, frágil: boolean) => ({
    id: uid(400 + n), nome: `EQ-0${n}`, tipos_compativeis: ["carga", "descarga"] as TipoOperacao[],
    aceita_carga_fragil: frágil, estado: "DISPONIVEL" as const, operacao_id: null,
  });
  return {
    versao: 1,
    criado_em: AGORA.toISOString(),
    areas,
    vagas: [vaga(1, 1), vaga(2, 1), vaga(3, 1), vaga(4, 1), vaga(5, 2), vaga(6, 3), vaga(7, 4)],
    docas: [doca(1, 1), doca(2, 2), doca(3, 3), doca(4, 1, "carga")],
    equipamentos: [eq(1, false), eq(2, true)],
    funcionarios: structuredClone(Object.values(FUNC)),
    operacoes: [],
    ocorrencias: [],
    politica: structuredClone(POLITICA_PADRAO),
    tempos: {
      media_espera_minutos: 0, media_operacao_minutos: 0, media_por_etapa_minutos: {},
      amostras: { espera: 0, operacao: 0 },
    },
  };
}

let seq = 0;
/** Operação em um estado, sem recursos (use os utilitários de vínculo para ocupar). */
export function op(
  estado: EstadoCaminhao,
  extra: Partial<OperacaoE> & { caracteristicas?: CaracteristicaCarga[]; chegadaMin?: number } = {},
): OperacaoE {
  const n = ++seq;
  const { caracteristicas, chegadaMin, ...resto } = extra;
  return {
    id: uid(500 + n),
    caminhao: {
      id: uid(600 + n), placa: `TST-${String(n).padStart(4, "0")}`,
      motorista: { id: uid(650 + n), nome: "Motorista", documento: `D${n}` },
      transportadora: { id: uid(700 + n), nome: "Transportadora" },
    },
    carga: { descricao: "Carga", caracteristicas: caracteristicas ?? ["comum"] },
    tipo: "descarga",
    chegada_em: atras(chegadaMin ?? 10),
    estado,
    documentacao_regular: true,
    vaga_id: null, doca_id: null, equipamento_id: null,
    funcionario_responsavel_id: null,
    iniciada_em: null, finalizada_em: null,
    cancelada: false, motivo_cancelamento: null,
    historico: [], inspecoes: [],
    duracao_estimada_minutos: null, interrupcao: null,
    ...resto,
  };
}

/** Coloca a operação na vaga (vínculo nos dois lados). */
export function naVaga(e: EstadoTerminal, o: OperacaoE, codigo: string) {
  const v = e.vagas.find((x) => x.codigo === codigo)!;
  v.estado = "OCUPADO"; v.operacao_id = o.id; o.vaga_id = v.id;
}
