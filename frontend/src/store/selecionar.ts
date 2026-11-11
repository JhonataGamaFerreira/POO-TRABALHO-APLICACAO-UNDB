/**
 * Seletor: transforma o estado normalizado (`EstadoTerminal`) no formato que as
 * telas já consomem (o contrato da API, com os campos da PROPOSTA). É a única
 * costura entre o motor de domínio e a interface; quando a API real for
 * integrada, este módulo é substituído por chamadas HTTP que devolvem o mesmo
 * formato `Terminal`.
 *
 * Tudo aqui é derivado: nada é persistido nem duplicado. Vagas, docas e
 * equipamentos aninhados nas operações são as MESMAS instâncias de `recursos`.
 */
import {
  acoesPermitidas,
  docasCompativeis,
  filaDe,
  interrupcaoDaDoca,
  metricaOcorrencia,
  ordenarOcorrencias,
  resumoDoPainel,
  vagasParaEntrada,
  restricaoDoca,
  temposMinutos,
  ESTADOS_ORDEM,
  type EstadoTerminal,
  type Funcionario,
  type OpcaoVaga,
} from "@/domain";
import type { AreaE } from "@/domain";
import type {
  AreaProposta,
  DashboardProposto,
  DocaProposta,
  EtapaFluxo,
  OcorrenciaProposta,
  OperacaoProposta,
  RecursosProposta,
  VagaProposta,
} from "@/types/terminal-proposto";
import type { RelatorioTempos } from "@/types/terminal";

export interface Terminal {
  dashboard: DashboardProposto;
  operacoes: OperacaoProposta[];
  fila: ReturnType<typeof filaDe>;
  ocorrencias: OcorrenciaProposta[];
  recursos: RecursosProposta;
  tempos: RelatorioTempos;
  compativeis: ReturnType<typeof docasCompativeis>[];
  /** Vagas candidatas à entrada de cada operação que aguarda entrada. */
  entrada: Array<{ operacao_id: string; vagas: OpcaoVaga[] }>;
  /** Funcionários fixos do terminal (nome e função, para mostrar o responsável). */
  funcionarios: Array<Pick<Funcionario, "id" | "nome" | "funcao">>;
}

const comoArea = (a: AreaE): AreaProposta => ({ ...a });

export function montarTerminal(e: EstadoTerminal, agora: Date): Terminal {
  const areas = new Map(e.areas.map((a) => [a.id, comoArea(a)]));

  const vagas: VagaProposta[] = e.vagas.map((v) => ({
    id: v.id, codigo: v.codigo, area: areas.get(v.area_id)!, estado: v.estado, operacao_id: v.operacao_id,
  }));
  const docas: DocaProposta[] = e.docas.map((d) => ({
    id: d.id, codigo: d.codigo, area: areas.get(d.area_id)!, tipo: d.tipo, estado: d.estado,
    operacao_id: d.operacao_id, manutencao_ate: d.estado === "EM_MANUTENCAO" ? d.manutencao_ate : null,
    interrupcao: interrupcaoDaDoca(e, d),
    restricao: interrupcaoDaDoca(e, d) ? null : restricaoDoca(e, d),
  }));
  const equipamentos = e.equipamentos.map((q) => ({ ...q }));
  const recursos: RecursosProposta = { vagas, docas, equipamentos };

  const vagaPorId = new Map(vagas.map((v) => [v.id, v]));
  const docaPorId = new Map(docas.map((d) => [d.id, d]));
  const equipPorId = new Map(equipamentos.map((q) => [q.id, q]));

  const ocorrenciasOrdenadas = ordenarOcorrencias(e.ocorrencias);
  const ocorrencias: OcorrenciaProposta[] = ocorrenciasOrdenadas.map((o) => {
    const { titulo, operacoes_afetadas, metrica_rotulo: _rotulo, ...base } = o;
    void _rotulo;
    return {
      ...base,
      titulo: titulo ?? "",
      operacoes_afetadas: operacoes_afetadas ?? [{ operacao_id: o.operacao_id, severidade: o.severidade }],
      metrica_impacto: metricaOcorrencia(e, o, agora),
    };
  });

  const operacoes: OperacaoProposta[] = e.operacoes.map((o) => ({
    id: o.id,
    caminhao: o.caminhao,
    carga: o.carga,
    tipo: o.tipo,
    chegada_em: o.chegada_em,
    estado: o.estado,
    documentacao_regular: o.documentacao_regular,
    vaga: o.vaga_id ? (vagaPorId.get(o.vaga_id) ?? null) : null,
    doca: o.doca_id ? (docaPorId.get(o.doca_id) ?? null) : null,
    equipamento: o.equipamento_id ? (equipPorId.get(o.equipamento_id) ?? null) : null,
    funcionario_responsavel_id: o.funcionario_responsavel_id,
    iniciada_em: o.iniciada_em,
    finalizada_em: o.finalizada_em,
    cancelada: o.cancelada,
    motivo_cancelamento: o.motivo_cancelamento,
    historico: o.historico,
    ocorrencias: e.ocorrencias
      .filter((x) => x.operacao_id === o.id)
      .map(({ titulo: _t, operacoes_afetadas: _a, metrica_rotulo: _m, operacao_id: _o, ...resto }) => {
        void _t; void _a; void _m; void _o;
        return resto;
      }),
    inspecoes: o.inspecoes,
    acoes_permitidas: acoesPermitidas(o),
    tempos_minutos: temposMinutos(o, agora),
    duracao_estimada_minutos: o.duracao_estimada_minutos,
  }));

  const fila = filaDe(e, agora);
  const resumo = resumoDoPainel(e);
  const etapas: EtapaFluxo[] = ESTADOS_ORDEM.map((estado) => ({
    estado,
    quantidade: resumo.por_estado[estado],
    media_minutos: e.tempos.media_por_etapa_minutos[estado] ?? null,
    // Destaque visual: etapa de espera por recurso com caminhões parados.
    faixa_espera: estado === "AGUARDANDO_RECURSO" && resumo.por_estado[estado] > 0 ? "atencao" : "normal",
  }));
  const dashboard: DashboardProposto = {
    ...resumo,
    etapas,
    finalizados_hoje: resumo.por_estado.FINALIZADO,
  };

  const naFila = new Set(fila.map((i) => i.operacao_id));
  const compativeis = e.operacoes.filter((o) => naFila.has(o.id)).map((o) => docasCompativeis(e, o));

  const entrada = e.operacoes
    .filter((o) => o.estado === "AGUARDANDO_ENTRADA")
    .map((o) => ({ operacao_id: o.id, vagas: vagasParaEntrada(e, o) }));
  const funcionarios = e.funcionarios.map(({ id, nome, funcao }) => ({ id, nome, funcao }));

  return { dashboard, operacoes, fila, ocorrencias, recursos, tempos: e.tempos, compativeis, entrada, funcionarios };
}
