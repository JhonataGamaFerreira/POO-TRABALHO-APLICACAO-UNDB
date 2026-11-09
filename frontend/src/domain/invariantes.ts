/**
 * Verificador das invariantes do back-end sobre um `EstadoTerminal`.
 *
 * Serve a dois propósitos:
 *  1. Provar que o cenário inicial respeita as regras (em vez de o motor
 *     "tolerar" inconsistências).
 *  2. Rede de segurança dos testes: depois de qualquer sequência de ações o
 *     estado precisa continuar sem violações.
 *
 * Cada violação cita a regra do back-end de onde vem (`main.py`, b16a874).
 */
import type { EstadoRecurso } from "@/types/terminal";
import { TRANSICOES, areaAdequada, equipamentoCompativel } from "./regras";
import type { EstadoTerminal, OperacaoE } from "./tipos";

export interface Violacao {
  codigo: string;
  mensagem: string;
}

const ESTADOS_VAGA_DOCA: EstadoRecurso[] = ["LIVRE", "OCUPADO", "EM_MANUTENCAO"];
const ESTADOS_EQUIPAMENTO: EstadoRecurso[] = ["DISPONIVEL", "OCUPADO", "EM_MANUTENCAO"];

/** Recursos que a operação deve ter em cada estado (`alocar_e_iniciar`, `autorizar_entrada`, `liberar_recursos`). */
const RECURSOS_POR_ESTADO: Record<OperacaoE["estado"], { vaga: boolean; doca: boolean; equipamento: boolean }> = {
  AGUARDANDO_DOCUMENTACAO: { vaga: false, doca: false, equipamento: false },
  AGUARDANDO_INSPECAO: { vaga: false, doca: false, equipamento: false },
  AGUARDANDO_ENTRADA: { vaga: false, doca: false, equipamento: false },
  NO_PATIO: { vaga: true, doca: false, equipamento: false },
  AGUARDANDO_RECURSO: { vaga: true, doca: false, equipamento: false },
  EM_OPERACAO: { vaga: true, doca: true, equipamento: true },
  AGUARDANDO_LIBERACAO: { vaga: false, doca: false, equipamento: false },
  FINALIZADO: { vaga: false, doca: false, equipamento: false },
};

export function verificarInvariantes(e: EstadoTerminal): Violacao[] {
  const v: Violacao[] = [];
  const add = (codigo: string, mensagem: string) => v.push({ codigo, mensagem });

  /* Identificadores únicos e referências */
  const ids = new Map<string, string>();
  const registrar = (tipo: string, id: string) => {
    if (ids.has(id)) add("ID_DUPLICADO", `${tipo} ${id} repete o id de ${ids.get(id)}.`);
    else ids.set(id, tipo);
  };
  e.areas.forEach((x) => registrar("área", x.id));
  e.vagas.forEach((x) => registrar("vaga", x.id));
  e.docas.forEach((x) => registrar("doca", x.id));
  e.equipamentos.forEach((x) => registrar("equipamento", x.id));
  e.operacoes.forEach((x) => registrar("operação", x.id));
  e.ocorrencias.forEach((x) => registrar("ocorrência", x.id));

  const funcionarios = new Set(e.funcionarios.map((f) => f.id));
  const rotulo = (o: OperacaoE) => `${o.caminhao.placa} (${o.estado})`;

  /* Recursos */
  for (const vg of e.vagas) {
    if (!ESTADOS_VAGA_DOCA.includes(vg.estado)) add("ESTADO_RECURSO", `Vaga ${vg.codigo} em estado ${vg.estado}.`);
    if (!e.areas.some((a) => a.id === vg.area_id)) add("REFERENCIA", `Vaga ${vg.codigo} sem área.`);
  }
  for (const d of e.docas) {
    if (!ESTADOS_VAGA_DOCA.includes(d.estado)) add("ESTADO_RECURSO", `Doca ${d.codigo} em estado ${d.estado}.`);
    if (!e.areas.some((a) => a.id === d.area_id)) add("REFERENCIA", `Doca ${d.codigo} sem área.`);
  }
  for (const q of e.equipamentos) {
    if (!ESTADOS_EQUIPAMENTO.includes(q.estado)) add("ESTADO_RECURSO", `Equipamento ${q.nome} em estado ${q.estado}.`);
  }

  const colecoes = [
    { nome: "Vaga", itens: e.vagas.map((x) => ({ id: x.id, rot: x.codigo, estado: x.estado, op: x.operacao_id, campo: "vaga_id" as const })) },
    { nome: "Doca", itens: e.docas.map((x) => ({ id: x.id, rot: x.codigo, estado: x.estado, op: x.operacao_id, campo: "doca_id" as const })) },
    { nome: "Equipamento", itens: e.equipamentos.map((x) => ({ id: x.id, rot: x.nome, estado: x.estado, op: x.operacao_id, campo: "equipamento_id" as const })) },
  ];
  for (const c of colecoes) {
    for (const r of c.itens) {
      if (r.estado === "OCUPADO") {
        const op = e.operacoes.find((o) => o.id === r.op);
        if (!op) add("RECURSO_ORFAO", `${c.nome} ${r.rot} ocupado(a) sem operação válida.`);
        else if (op[r.campo] !== r.id) add("VINCULO_ASSIMETRICO", `${c.nome} ${r.rot} aponta para ${rotulo(op)}, que não aponta de volta.`);
      } else if (r.op !== null) {
        add("RECURSO_COM_OPERACAO", `${c.nome} ${r.rot} (${r.estado}) ainda aponta para uma operação.`);
      }
    }
  }

  /* Operações */
  for (const o of e.operacoes) {
    const exigidos = RECURSOS_POR_ESTADO[o.estado];
    const tem = { vaga: !!o.vaga_id, doca: !!o.doca_id, equipamento: !!o.equipamento_id };
    for (const k of ["vaga", "doca", "equipamento"] as const) {
      if (exigidos[k] && !tem[k]) add("RECURSO_AUSENTE", `${rotulo(o)} deveria ter ${k}.`);
      if (!exigidos[k] && tem[k]) add("RECURSO_INDEVIDO", `${rotulo(o)} não deveria ocupar ${k} neste estado.`);
    }

    const vaga = o.vaga_id ? e.vagas.find((x) => x.id === o.vaga_id) : undefined;
    const doca = o.doca_id ? e.docas.find((x) => x.id === o.doca_id) : undefined;
    const equip = o.equipamento_id ? e.equipamentos.find((x) => x.id === o.equipamento_id) : undefined;
    if (o.vaga_id && !vaga) add("REFERENCIA", `${rotulo(o)} aponta para vaga inexistente.`);
    if (o.doca_id && !doca) add("REFERENCIA", `${rotulo(o)} aponta para doca inexistente.`);
    if (o.equipamento_id && !equip) add("REFERENCIA", `${rotulo(o)} aponta para equipamento inexistente.`);
    if (vaga && (vaga.estado !== "OCUPADO" || vaga.operacao_id !== o.id)) {
      add("VINCULO_ASSIMETRICO", `${rotulo(o)}: vaga ${vaga.codigo} não está ocupada por ela.`);
    }
    if (doca && (doca.estado !== "OCUPADO" || doca.operacao_id !== o.id)) {
      add("VINCULO_ASSIMETRICO", `${rotulo(o)}: doca ${doca.codigo} não está ocupada por ela.`);
    }
    if (equip && (equip.estado !== "OCUPADO" || equip.operacao_id !== o.id)) {
      add("VINCULO_ASSIMETRICO", `${rotulo(o)}: equipamento ${equip.nome} não está em uso por ela.`);
    }

    /* Compatibilidade carga × recurso */
    if (vaga && !areaAdequada(e.areas.find((a) => a.id === vaga.area_id)!, o)) {
      add("VAGA_INADEQUADA", `${rotulo(o)} está na vaga ${vaga.codigo}, inadequada para a carga.`);
    }
    if (doca) {
      if (doca.tipo !== null && doca.tipo !== o.tipo) add("DOCA_INADEQUADA", `${rotulo(o)} em doca ${doca.codigo} de outro tipo.`);
      if (!areaAdequada(e.areas.find((a) => a.id === doca.area_id)!, o)) {
        add("DOCA_INADEQUADA", `${rotulo(o)} está na doca ${doca.codigo}, inadequada para a carga.`);
      }
    }
    if (equip && !equipamentoCompativel({ ...equip, estado: "DISPONIVEL" }, o)) {
      add("EQUIPAMENTO_INCOMPATIVEL", `${rotulo(o)} usa ${equip.nome}, incompatível com a carga.`);
    }

    /* Estado × campos de ciclo de vida */
    if (o.estado === "EM_OPERACAO" && !o.iniciada_em) add("SEM_INICIO", `${rotulo(o)} em operação sem iniciada_em.`);
    if (o.cancelada && !o.motivo_cancelamento) add("CANCELAMENTO_SEM_MOTIVO", `${rotulo(o)} cancelada sem motivo.`);
    if (o.interrupcao && o.estado !== "AGUARDANDO_RECURSO") {
      add("INTERRUPCAO_FORA_DE_ETAPA", `${rotulo(o)} tem interrupção fora de AGUARDANDO_RECURSO.`);
    }
    if (o.funcionario_responsavel_id && !funcionarios.has(o.funcionario_responsavel_id)) {
      add("REFERENCIA", `${rotulo(o)} tem responsável inexistente.`);
    }

    /* Histórico coerente com a máquina de estados */
    const mudancas = o.historico.filter((h) => h.tipo === "MUDANCA_ESTADO");
    for (const h of mudancas) {
      if (h.estado_anterior && h.estado_novo && !TRANSICOES[h.estado_anterior].includes(h.estado_novo)) {
        add("TRANSICAO_INVALIDA", `${rotulo(o)}: ${h.estado_anterior} → ${h.estado_novo} não é permitido.`);
      }
    }
    const ultima = mudancas.at(-1);
    if (ultima && ultima.estado_novo !== o.estado) {
      add("HISTORICO_DESALINHADO", `${rotulo(o)}: último evento leva a ${ultima.estado_novo}.`);
    }
  }

  /* Ocorrências */
  for (const oc of e.ocorrencias) {
    if (!e.operacoes.some((o) => o.id === oc.operacao_id)) add("REFERENCIA", `Ocorrência ${oc.id} sem operação.`);
    if (oc.estado === "RESOLVIDA" && (!oc.resolvida_em || !oc.resolvida_por)) {
      add("RESOLUCAO_INCOMPLETA", `Ocorrência ${oc.id} resolvida sem data ou responsável.`);
    }
    if (oc.estado === "ABERTA" && (oc.resolvida_em || oc.resolvida_por)) {
      add("RESOLUCAO_INDEVIDA", `Ocorrência ${oc.id} aberta com dados de resolução.`);
    }
  }

  return v;
}
