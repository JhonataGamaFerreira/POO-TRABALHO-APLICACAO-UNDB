/**
 * Etapa 3: execução das operações (iniciar, aguardar recurso, concluir, liberar,
 * interromper, retomar, cancelar, resolver ocorrência e manutenção).
 *
 * Onde o MVP do front difere do backend (b16a874), os testes fixam o comportamento
 * do front; as diferenças estão em docs/divergencias-backend-mvp.md.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CaracteristicaCarga, EstadoCaminhao } from "@/types/terminal";
import { criarCenarioInicial } from "@/mocks/cenario";
import { executar } from "./acoes";
import { acoesPermitidas, avaliarInicio, motivoEspera } from "./derivados";
import { AGORA, FUNC, naVaga, op, terminalBase } from "./fabrica-teste";
import { verificarInvariantes } from "./invariantes";
import { ErroDeDominio, type Acao, type EstadoTerminal, type OperacaoE } from "./tipos";

let ids = 20_000;
/** Contexto com relógio deslocado em `min` minutos e ids sempre novos. */
const ctxEm = (min = 0) => ({
  agora: new Date(AGORA.getTime() + min * 60_000),
  novoId: () => `00000000-0000-4000-8000-${String(ids++).padStart(12, "0")}`,
});
const rodar = (e: EstadoTerminal, a: Acao, min = 0) => executar(e, a, ctxEm(min));
const semViolacoes = (e: EstadoTerminal) => assert.deepEqual(verificarInvariantes(e), []);
const erro = (fn: () => unknown, trecho: RegExp) =>
  assert.throws(fn, (x) => x instanceof ErroDeDominio && trecho.test(x.message));
const por = (e: EstadoTerminal, id: string) => e.operacoes.find((o) => o.id === id)!;
const codigos = (e: EstadoTerminal, o: OperacaoE) => ({
  vaga: e.vagas.find((v) => v.id === o.vaga_id)?.codigo ?? null,
  doca: e.docas.find((d) => d.id === o.doca_id)?.codigo ?? null,
  equipamento: e.equipamentos.find((q) => q.id === o.equipamento_id)?.nome ?? null,
});

/** Terminal pequeno com uma operação de descarga no pátio (vaga V01 ocupada). */
function noPatio(car: CaracteristicaCarga[] = ["comum"], vaga = "V01") {
  const e = terminalBase();
  const o = op("NO_PATIO", { caracteristicas: car });
  e.operacoes = [o];
  naVaga(e, o, vaga);
  return { e, o };
}

/** Só uma doca (D1) e um equipamento (EQ-01): a disputa por recurso fica explícita. */
function recursoUnico() {
  const e = terminalBase();
  e.docas = e.docas.filter((d) => d.codigo === "D1");
  e.equipamentos = e.equipamentos.filter((q) => q.nome === "EQ-01");
  return e;
}

const interromper = (operacaoId: string, extra: Partial<Extract<Acao, { tipo: "interrupt" }>> = {}): Acao => ({
  tipo: "interrupt", operacaoId, descricao: "Operador ausente", equipamentoQuebrado: false,
  severidade: "media", impacto: "operacao", ...extra,
});

describe("Etapa 3 · iniciar e aguardar recursos", () => {
  it("com recursos vai direto a EM_OPERACAO, com uma única mudança de estado", () => {
    const { e, o } = noPatio();
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    const n = por(r.estado, o.id);
    assert.equal(r.resultado.iniciada, true);
    assert.equal(n.estado, "EM_OPERACAO");
    const mudancas = n.historico.filter((h) => h.tipo === "MUDANCA_ESTADO");
    assert.deepEqual(mudancas.map((h) => [h.estado_anterior, h.estado_novo]), [["NO_PATIO", "EM_OPERACAO"]]);
    assert.deepEqual(n.historico.map((h) => h.tipo), ["ALOCACAO_RECURSO", "MUDANCA_ESTADO", "OPERACAO_INICIADA"]);
    assert.equal(n.historico.at(-1)!.descricao, "Operação iniciada.");
    assert.equal(n.funcionario_responsavel_id, FUNC.operador.id);
    semViolacoes(r.estado);
  });

  it("sem equipamento: nada é reservado e a operação passa a aguardar recurso", () => {
    const { e, o } = noPatio();
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    const antes = structuredClone(e);
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    const n = por(r.estado, o.id);
    assert.equal(r.resultado.iniciada, false);
    assert.match(r.resultado.mensagem, /aguarda recurso/);
    assert.equal(n.estado, "AGUARDANDO_RECURSO");
    assert.deepEqual([n.doca_id, n.equipamento_id], [null, null]);
    assert.equal(n.vaga_id, o.vaga_id); // a vaga do pátio continua sendo dele
    assert.deepEqual(r.estado.docas, antes.docas);
    assert.deepEqual(r.estado.equipamentos, antes.equipamentos);
    assert.deepEqual(n.historico.map((h) => h.estado_novo), ["AGUARDANDO_RECURSO"]);
    semViolacoes(r.estado);
  });

  it("falta só um dos três recursos: os outros dois não ficam presos", () => {
    const { e, o } = noPatio();
    e.docas.forEach((d) => (d.estado = "EM_MANUTENCAO")); // vaga e equipamento existem; doca não
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    assert.equal(r.resultado.iniciada, false);
    assert.equal(r.estado.equipamentos.every((q) => q.estado === "DISPONIVEL" && q.operacao_id === null), true);
    semViolacoes(r.estado);
  });

  it("aguardando recurso e ainda sem recurso: tentar de novo não muda nada", () => {
    const { e, o } = noPatio();
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    const r1 = rodar(e, { tipo: "start", operacaoId: o.id });
    const r2 = rodar(r1.estado, { tipo: "start", operacaoId: o.id }, 5);
    assert.equal(r2.resultado.iniciada, false);
    assert.deepEqual(r2.estado, r1.estado);
  });

  it("a prévia (avaliarInicio) é exatamente o que o início aloca", () => {
    const casos: Array<[CaracteristicaCarga[], string]> = [
      [["comum"], "V01"],
      [["refrigerada"], "V05"],
      [["perigosa"], "V06"],
      [["frágil"], "V01"],
    ];
    for (const [car, vaga] of casos) {
      const { e, o } = noPatio(car, vaga);
      const previa = avaliarInicio(e, o);
      assert.equal(previa.pode, true, car.join());
      assert.equal(previa.retomada, false);
      assert.equal(previa.motivo, null);
      const r = rodar(e, { tipo: "start", operacaoId: o.id });
      const n = por(r.estado, o.id);
      assert.deepEqual(
        [previa.vaga!.id, previa.doca!.id, previa.equipamento!.id],
        [n.vaga_id, n.doca_id, n.equipamento_id],
        car.join(),
      );
    }
  });

  it("a prévia explica por que não dá para iniciar", () => {
    const { e, o } = noPatio();
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    const a = avaliarInicio(e, o);
    assert.equal(a.pode, false);
    assert.equal(a.motivo, "Aguarda EQ-01 e EQ-02 (em manutenção)");
    assert.deepEqual([a.doca !== null, a.equipamento], [true, null]);
    e.docas.forEach((d) => (d.estado = "OCUPADO"));
    assert.match(avaliarInicio(e, o).motivo!, /^Sem doca livre; /);
    // vaga atual inválida e nenhuma outra livre adequada
    const g = noPatio();
    g.e.vagas.filter((v) => v.operacao_id === null).forEach((v) => (v.estado = "OCUPADO"));
    g.e.areas[0].interditada = true;
    assert.equal(avaliarInicio(g.e, g.o).pode, false);
  });

  it("carga refrigerada sem doca refrigerada livre espera, sem reservar nada", () => {
    const { e, o } = noPatio(["refrigerada"], "V05");
    e.docas.find((d) => d.codigo === "D2")!.estado = "EM_MANUTENCAO";
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    assert.equal(r.resultado.iniciada, false);
    assert.equal(r.estado.equipamentos.every((q) => q.estado === "DISPONIVEL"), true);
    assert.equal(motivoEspera(r.estado, por(r.estado, o.id)), "Sem doca refrigerada livre; D2 em manutenção");
    semViolacoes(r.estado);
  });

  it("ações permitidas por estado seguem a API (iniciar só no pátio/aguardando recurso)", () => {
    const mapa: Array<[EstadoCaminhao, string[]]> = [
      ["NO_PATIO", ["start", "interrupt", "cancel"]],
      ["AGUARDANDO_RECURSO", ["start", "interrupt", "cancel"]],
      ["EM_OPERACAO", ["finish", "interrupt"]],
      ["AGUARDANDO_LIBERACAO", ["release"]],
      ["FINALIZADO", []],
    ];
    for (const [estado, acoes] of mapa) assert.deepEqual(acoesPermitidas(op(estado)), acoes, estado);
  });
});

describe("Etapa 3 · interromper e retomar", () => {
  const emOperacao = (e0 = terminalBase()) => {
    const o = op("NO_PATIO");
    e0.operacoes = [o];
    naVaga(e0, o, "V01");
    return { e: rodar(e0, { tipo: "start", operacaoId: o.id }, 0).estado, id: o.id };
  };

  it("registra a ocorrência com descrição, responsável, gravidade, impacto e recurso", () => {
    const { e, id } = emOperacao();
    const docaId = por(e, id).doca_id!;
    const r = rodar(
      e,
      interromper(id, { descricao: "  Operador ausente da doca  ", severidade: "alta", impacto: "seguranca", recurso: { tipo: "doca", id: docaId } }),
      25,
    );
    const oc = r.estado.ocorrencias[0];
    assert.equal(oc.descricao, "Operador ausente da doca");
    assert.equal(oc.tipo, "ATRASO");
    assert.equal(oc.severidade, "alta");
    assert.equal(oc.impacto, "seguranca");
    assert.deepEqual([oc.recurso_tipo, oc.recurso_id], ["doca", docaId]);
    assert.equal(oc.responsavel_id, FUNC.operador.id);
    assert.equal(oc.estado, "ABERTA");
    const n = por(r.estado, id);
    assert.equal(n.estado, "AGUARDANDO_RECURSO");
    assert.equal(n.interrupcao?.minutos_operados, 25);
    assert.deepEqual(n.historico.slice(-2).map((h) => h.tipo), ["OCORRENCIA", "MUDANCA_ESTADO"]);
    assert.equal(n.historico.at(-1)!.estado_novo, "AGUARDANDO_RECURSO");
    semViolacoes(r.estado);
  });

  it("equipamento quebrado: o equipamento é o recurso da ocorrência e vai para manutenção", () => {
    const { e, id } = emOperacao();
    const eq = por(e, id).equipamento_id!;
    const r = rodar(e, interromper(id, { descricao: "Falha hidráulica", equipamentoQuebrado: true, severidade: "critica", impacto: "recurso" }));
    const oc = r.estado.ocorrencias[0];
    assert.equal(oc.tipo, "EQUIPAMENTO_QUEBRADO");
    assert.deepEqual([oc.recurso_tipo, oc.recurso_id], ["equipment", eq]);
    assert.equal(r.estado.equipamentos.find((q) => q.id === eq)!.estado, "EM_MANUTENCAO");
    semViolacoes(r.estado);
  });

  it("retomar passa de novo pela alocação: bloqueado enquanto o único equipamento está quebrado", () => {
    const e0 = recursoUnico();
    const { e, id } = emOperacao(e0);
    const quebrou = rodar(e, interromper(id, { equipamentoQuebrado: true }), 20).estado;
    const a = avaliarInicio(quebrou, por(quebrou, id));
    assert.equal(a.pode, false);
    assert.equal(a.retomada, true);
    assert.equal(a.motivo, "Aguarda EQ-01 (quebrado)");
    const tenta = rodar(quebrou, { tipo: "start", operacaoId: id }, 30);
    assert.equal(tenta.resultado.iniciada, false);
    assert.equal(por(tenta.estado, id).estado, "AGUARDANDO_RECURSO");
    assert.notEqual(por(tenta.estado, id).interrupcao, null);
    assert.deepEqual(tenta.estado.equipamentos, quebrou.equipamentos);
    semViolacoes(tenta.estado);
  });

  it("depois de concluir a manutenção a operação é retomada na mesma vaga, sem perder o início", () => {
    const e0 = recursoUnico();
    const { e, id } = emOperacao(e0);
    const iniciada = por(e, id).iniciada_em;
    const vagaAntes = por(e, id).vaga_id;
    const quebrou = rodar(e, interromper(id, { equipamentoQuebrado: true }), 20).estado;
    const eqId = quebrou.equipamentos[0].id;
    const manut = rodar(quebrou, { tipo: "maintenance", recurso: { tipo: "equipment", id: eqId }, emManutencao: false }, 40).estado;
    assert.equal(manut.equipamentos[0].estado, "DISPONIVEL");
    assert.equal(manut.ocorrencias[0].estado, "ABERTA"); // concluir manutenção não resolve a ocorrência
    assert.equal(avaliarInicio(manut, por(manut, id)).pode, true);
    const r = rodar(manut, { tipo: "start", operacaoId: id }, 45);
    const n = por(r.estado, id);
    assert.equal(r.resultado.iniciada, true);
    assert.match(r.resultado.mensagem, /retomada/);
    assert.equal(n.estado, "EM_OPERACAO");
    assert.equal(n.interrupcao, null);
    assert.equal(n.iniciada_em, iniciada);
    assert.equal(n.vaga_id, vagaAntes);
    assert.equal(n.historico.at(-1)!.tipo, "OPERACAO_INICIADA");
    assert.equal(n.historico.at(-1)!.descricao, "Operação retomada.");
    assert.deepEqual(codigos(r.estado, n), { vaga: "V01", doca: "D1", equipamento: "EQ-01" });
    semViolacoes(r.estado);
  });

  it("outra operação pode ocupar os recursos liberados: a interrompida espera até haver recurso", () => {
    const e0 = recursoUnico();
    const a = op("NO_PATIO");
    const b = op("NO_PATIO");
    e0.operacoes = [a, b];
    naVaga(e0, a, "V01");
    naVaga(e0, b, "V02");
    let e = rodar(e0, { tipo: "start", operacaoId: a.id }).estado;
    e = rodar(e, interromper(a.id), 10).estado; // libera D1 e EQ-01, mantém V01
    assert.equal(por(e, a.id).vaga_id, a.vaga_id);
    e = rodar(e, { tipo: "start", operacaoId: b.id }, 11).estado; // B ocupa D1/EQ-01
    assert.equal(por(e, b.id).estado, "EM_OPERACAO");
    const tenta = rodar(e, { tipo: "start", operacaoId: a.id }, 12);
    assert.equal(tenta.resultado.iniciada, false);
    assert.equal(por(tenta.estado, a.id).estado, "AGUARDANDO_RECURSO");
    assert.notEqual(por(tenta.estado, a.id).interrupcao, null);
    semViolacoes(tenta.estado);
    // B conclui: os recursos voltam e A retoma
    e = rodar(tenta.estado, { tipo: "finish", operacaoId: b.id }, 20).estado;
    const retoma = rodar(e, { tipo: "start", operacaoId: a.id }, 21);
    assert.equal(retoma.resultado.iniciada, true);
    assert.equal(por(retoma.estado, a.id).estado, "EM_OPERACAO");
    semViolacoes(retoma.estado);
  });
});

describe("Etapa 3 · cancelar", () => {
  const estadosDoMVP: EstadoCaminhao[] = [
    "AGUARDANDO_DOCUMENTACAO",
    "AGUARDANDO_INSPECAO",
    "AGUARDANDO_ENTRADA",
    "NO_PATIO",
    "AGUARDANDO_RECURSO",
  ];

  for (const estado of estadosDoMVP) {
    it(`cancela em ${estado}: libera a vaga e aguarda liberação`, () => {
      const e = terminalBase();
      const o = op(estado);
      e.operacoes = [o];
      if (estado === "NO_PATIO" || estado === "AGUARDANDO_RECURSO") naVaga(e, o, "V01");
      const r = rodar(e, { tipo: "cancel", operacaoId: o.id, motivo: "Desistência do motorista" });
      const n = por(r.estado, o.id);
      assert.equal(n.estado, "AGUARDANDO_LIBERACAO");
      assert.equal(n.cancelada, true);
      assert.equal(n.motivo_cancelamento, "Desistência do motorista");
      assert.equal(n.vaga_id, null);
      assert.equal(r.estado.vagas.every((v) => v.estado === "LIVRE"), true);
      assert.equal(r.estado.ocorrencias.at(-1)!.tipo, "CANCELAMENTO");
      assert.deepEqual(n.historico.slice(-2).map((h) => h.tipo), ["OCORRENCIA", "MUDANCA_ESTADO"]);
      semViolacoes(r.estado);
    });
  }

  it("não cancela em EM_OPERACAO: é preciso interromper antes, e o estado não muda", () => {
    const { e, o } = noPatio();
    const andando = rodar(e, { tipo: "start", operacaoId: o.id }).estado;
    const antes = structuredClone(andando);
    erro(() => rodar(andando, { tipo: "cancel", operacaoId: o.id, motivo: "x" }), /interrompa antes de cancelar/);
    assert.deepEqual(andando, antes);
  });

  it("interromper e depois cancelar libera também a vaga mantida; liberar encerra o fluxo", () => {
    const { e, o } = noPatio();
    let s = rodar(e, { tipo: "start", operacaoId: o.id }).estado;
    s = rodar(s, interromper(o.id), 10).estado;
    assert.ok(por(s, o.id).vaga_id);
    s = rodar(s, { tipo: "cancel", operacaoId: o.id, motivo: "Falha irrecuperável" }, 12).estado;
    let n = por(s, o.id);
    assert.deepEqual([n.estado, n.vaga_id, n.doca_id, n.equipamento_id], ["AGUARDANDO_LIBERACAO", null, null, null]);
    assert.equal(s.vagas.every((v) => v.estado === "LIVRE"), true);
    assert.equal(n.interrupcao, null);
    assert.deepEqual(acoesPermitidas(n), ["release"]);
    semViolacoes(s);
    s = rodar(s, { tipo: "release", operacaoId: o.id }, 15).estado;
    n = por(s, o.id);
    assert.equal(n.estado, "FINALIZADO");
    assert.equal(n.cancelada, true);
    semViolacoes(s);
  });
});

describe("Etapa 3 · concluir e liberar são ações diferentes", () => {
  it("concluir encaminha para aguardando liberação e libera os recursos; liberar finaliza", () => {
    const { e, o } = noPatio();
    let s = rodar(e, { tipo: "start", operacaoId: o.id }).estado;
    erro(() => rodar(s, { tipo: "release", operacaoId: o.id }), /aguardando liberação/);
    s = rodar(s, { tipo: "finish", operacaoId: o.id }, 40).estado;
    let n = por(s, o.id);
    assert.equal(n.estado, "AGUARDANDO_LIBERACAO");
    assert.equal(n.finalizada_em, ctxEm(40).agora.toISOString());
    assert.deepEqual([n.vaga_id, n.doca_id, n.equipamento_id], [null, null, null]);
    assert.equal(s.vagas.every((v) => v.estado === "LIVRE"), true);
    assert.equal(s.docas.every((d) => d.estado === "LIVRE"), true);
    assert.equal(s.equipamentos.every((q) => q.estado === "DISPONIVEL"), true);
    assert.deepEqual(n.historico.slice(-2).map((h) => h.tipo), ["MUDANCA_ESTADO", "OPERACAO_FINALIZADA"]);
    erro(() => rodar(s, { tipo: "finish", operacaoId: o.id }), /em andamento/);
    s = rodar(s, { tipo: "release", operacaoId: o.id }, 45).estado;
    n = por(s, o.id);
    assert.equal(n.estado, "FINALIZADO");
    assert.equal(n.historico.at(-1)!.estado_novo, "FINALIZADO");
    semViolacoes(s);
  });

  it("concluir libera os recursos para quem esperava, que consegue iniciar em seguida", () => {
    const e0 = recursoUnico();
    const a = op("NO_PATIO");
    const b = op("NO_PATIO");
    e0.operacoes = [a, b];
    naVaga(e0, a, "V01");
    naVaga(e0, b, "V02");
    let e = rodar(e0, { tipo: "start", operacaoId: a.id }).estado;
    const espera = rodar(e, { tipo: "start", operacaoId: b.id }, 1);
    assert.equal(espera.resultado.iniciada, false);
    e = espera.estado;
    assert.equal(avaliarInicio(e, por(e, b.id)).pode, false);
    e = rodar(e, { tipo: "finish", operacaoId: a.id }, 10).estado;
    assert.equal(avaliarInicio(e, por(e, b.id)).pode, true);
    e = rodar(e, { tipo: "start", operacaoId: b.id }, 11).estado;
    assert.deepEqual(codigos(e, por(e, b.id)), { vaga: "V02", doca: "D1", equipamento: "EQ-01" });
    semViolacoes(e);
  });
});

describe("Etapa 3 · ocorrências e manutenção", () => {
  it("equipamento em uso não vai para manutenção; depois de concluir a operação, vai", () => {
    const { e, o } = noPatio();
    const s = rodar(e, { tipo: "start", operacaoId: o.id }).estado;
    const eqId = por(s, o.id).equipamento_id!;
    erro(() => rodar(s, { tipo: "maintenance", recurso: { tipo: "equipment", id: eqId }, emManutencao: true }), /ocupado/);
    const livre = rodar(s, { tipo: "finish", operacaoId: o.id }, 5).estado;
    const m = rodar(livre, { tipo: "maintenance", recurso: { tipo: "equipment", id: eqId }, emManutencao: true }, 6).estado;
    assert.equal(m.equipamentos.find((q) => q.id === eqId)!.estado, "EM_MANUTENCAO");
    semViolacoes(m);
  });

  it("resolver a ocorrência não devolve o equipamento: isso é a conclusão da manutenção", () => {
    const e0 = recursoUnico();
    const o = op("NO_PATIO");
    e0.operacoes = [o];
    naVaga(e0, o, "V01");
    let e = rodar(e0, { tipo: "start", operacaoId: o.id }).estado;
    e = rodar(e, interromper(o.id, { equipamentoQuebrado: true }), 10).estado;
    const ocId = e.ocorrencias[0].id;
    e = rodar(e, { tipo: "resolve-occurrence", ocorrenciaId: ocId }, 20).estado;
    assert.equal(e.ocorrencias[0].estado, "RESOLVIDA");
    assert.equal(e.ocorrencias[0].resolvida_por, FUNC.supervisor.id);
    assert.equal(e.equipamentos[0].estado, "EM_MANUTENCAO");
    assert.equal(avaliarInicio(e, por(e, o.id)).pode, false);
    erro(() => rodar(e, { tipo: "resolve-occurrence", ocorrenciaId: ocId }), /já está resolvida/);
    e = rodar(e, { tipo: "maintenance", recurso: { tipo: "equipment", id: e.equipamentos[0].id }, emManutencao: false }, 30).estado;
    assert.equal(avaliarInicio(e, por(e, o.id)).pode, true);
    semViolacoes(e);
  });

  it("doca em manutenção não recebe operação; concluída a manutenção, volta a receber", () => {
    const { e, o } = noPatio();
    e.docas = e.docas.filter((d) => d.codigo === "D1");
    const m = rodar(e, { tipo: "maintenance", recurso: { tipo: "doca", id: e.docas[0].id }, emManutencao: true }).estado;
    assert.equal(rodar(m, { tipo: "start", operacaoId: o.id }).resultado.iniciada, false);
    const v = rodar(m, { tipo: "maintenance", recurso: { tipo: "doca", id: e.docas[0].id }, emManutencao: false }).estado;
    assert.equal(rodar(v, { tipo: "start", operacaoId: o.id }).resultado.iniciada, true);
  });

  it("interdição bloqueia a área só quando nada nela está ocupado e pode ser desfeita", () => {
    const { e, o } = noPatio();
    const geral = e.areas[0];
    erro(() => rodar(e, { tipo: "area-interdicao", areaId: geral.id, interditada: true, motivo: "obra" }), /Libere os recursos ocupados/);
    const s = rodar(e, { tipo: "cancel", operacaoId: o.id, motivo: "x" }).estado;
    const i = rodar(s, { tipo: "area-interdicao", areaId: geral.id, interditada: true, motivo: "obra" }).estado;
    assert.equal(i.areas[0].interditada, true);
    assert.equal(i.areas[0].motivo_interdicao, "obra");
    const l = rodar(i, { tipo: "area-interdicao", areaId: geral.id, interditada: false }).estado;
    assert.equal(l.areas[0].interditada, false);
    assert.equal(l.areas[0].motivo_interdicao, null);
  });
});

describe("Etapa 3 · demonstração com o seed original", () => {
  const seed = () => criarCenarioInicial(AGORA);
  const get = (e: EstadoTerminal, placa: string) => e.operacoes.find((o) => o.caminhao.placa === placa)!;
  const executando = (e: EstadoTerminal, a: Acao, min: number) => {
    const r = rodar(e, a, min);
    semViolacoes(r.estado);
    return r;
  };

  it("o seed mantém 18 vagas, 8 docas, 6 equipamentos e 40 operações", () => {
    const e = seed();
    assert.deepEqual([e.vagas.length, e.docas.length, e.equipamentos.length, e.operacoes.length], [18, 8, 6, 40]);
  });

  it("no seed nenhuma operação do pátio consegue iniciar: falta equipamento livre", () => {
    const e = seed();
    const esperando = e.operacoes.filter((o) => o.estado === "NO_PATIO" || o.estado === "AGUARDANDO_RECURSO");
    assert.ok(esperando.length >= 7);
    for (const o of esperando) assert.equal(avaliarInicio(e, o).pode, false, o.caminhao.placa);
  });

  it("sequência: concluir PQR-1A11 libera D1/EQ-01 → iniciar RIO-9D01 → TPN-3E58 espera → liberar JKL-7G45", () => {
    let e = seed();
    const antes = { vagas: e.vagas.map((v) => v.codigo), docas: e.docas.map((d) => d.codigo) };

    e = executando(e, { tipo: "finish", operacaoId: get(e, "PQR-1A11").id }, 1).estado;
    assert.equal(get(e, "PQR-1A11").estado, "AGUARDANDO_LIBERACAO");
    assert.equal(e.docas.find((d) => d.codigo === "D1")!.estado, "LIVRE");
    assert.equal(e.equipamentos.find((q) => q.nome === "EQ-01")!.estado, "DISPONIVEL");

    const r1 = executando(e, { tipo: "start", operacaoId: get(e, "RIO-9D01").id }, 2);
    e = r1.estado;
    assert.equal(r1.resultado.iniciada, true);
    assert.equal(get(e, "RIO-9D01").estado, "EM_OPERACAO");
    assert.deepEqual(codigos(e, get(e, "RIO-9D01")), { vaga: "V01", doca: "D1", equipamento: "EQ-01" });

    const r2 = executando(e, { tipo: "start", operacaoId: get(e, "TPN-3E58").id }, 3);
    e = r2.estado;
    assert.equal(r2.resultado.iniciada, false);
    assert.equal(get(e, "TPN-3E58").estado, "AGUARDANDO_RECURSO");

    const rel = executando(e, { tipo: "release", operacaoId: get(e, "JKL-7G45").id }, 4);
    e = rel.estado;
    assert.equal(get(e, "JKL-7G45").estado, "FINALIZADO");

    const cancel = executando(e, { tipo: "cancel", operacaoId: get(e, "UVW-1H22").id, motivo: "Desistência do transportador" }, 5);
    e = cancel.estado;
    assert.equal(get(e, "UVW-1H22").estado, "AGUARDANDO_LIBERACAO");

    assert.deepEqual({ vagas: e.vagas.map((v) => v.codigo), docas: e.docas.map((d) => d.codigo) }, antes);
  });

  it("sequência: interromper CDE-4D44 libera D5/EQ-03 para TPN-3E58; CDE-4D44 espera e retoma depois", () => {
    let e = seed();
    e = executando(e, { tipo: "finish", operacaoId: get(e, "PQR-1A11").id }, 1).estado;
    e = executando(e, { tipo: "start", operacaoId: get(e, "RIO-9D01").id }, 2).estado;
    e = executando(e, { tipo: "start", operacaoId: get(e, "TPN-3E58").id }, 3).estado; // aguarda
    const cdeVaga = get(e, "CDE-4D44").vaga_id;
    e = executando(e, interromper(get(e, "CDE-4D44").id, { descricao: "Operador ausente" }), 10).estado;
    assert.equal(get(e, "CDE-4D44").estado, "AGUARDANDO_RECURSO");
    assert.equal(get(e, "CDE-4D44").vaga_id, cdeVaga); // a vaga fica com o caminhão
    assert.equal(e.docas.find((d) => d.codigo === "D5")!.estado, "LIVRE");

    // TPN-3E58 estava na frente na espera por recurso e inicia com o que foi liberado
    const tpn = executando(e, { tipo: "start", operacaoId: get(e, "TPN-3E58").id }, 11);
    e = tpn.estado;
    assert.equal(tpn.resultado.iniciada, true);

    // CDE-4D44 tenta retomar, não há equipamento livre: espera, ainda marcada como interrompida
    const cde = executando(e, { tipo: "start", operacaoId: get(e, "CDE-4D44").id }, 12);
    e = cde.estado;
    assert.equal(cde.resultado.iniciada, false);
    assert.notEqual(get(e, "CDE-4D44").interrupcao, null);

    // TPN-3E58 conclui e CDE-4D44 retoma
    e = executando(e, { tipo: "finish", operacaoId: get(e, "TPN-3E58").id }, 30).estado;
    const volta = executando(e, { tipo: "start", operacaoId: get(e, "CDE-4D44").id }, 31);
    assert.equal(volta.resultado.iniciada, true);
    assert.equal(get(volta.estado, "CDE-4D44").interrupcao, null);
    assert.equal(get(volta.estado, "CDE-4D44").estado, "EM_OPERACAO");
  });

  it("sequência: manutenção concluída em EQ-02 destrava FGH-2J34 (perigosa, prioritária)", () => {
    let e = seed();
    const eq02 = e.equipamentos.find((q) => q.nome === "EQ-02")!;
    assert.equal(eq02.estado, "EM_MANUTENCAO");
    const fgh = get(e, "FGH-2J34");
    assert.equal(avaliarInicio(e, fgh).pode, false);
    e = executando(e, { tipo: "maintenance", recurso: { tipo: "equipment", id: eq02.id }, emManutencao: false }, 1).estado;
    const a = avaliarInicio(e, get(e, "FGH-2J34"));
    // com EQ-02 disponível falta apenas doca para carga perigosa (D1/D6 estão ocupadas)
    assert.equal(a.equipamento?.nome, "EQ-02");
    assert.equal(a.pode, a.doca !== null);
  });
});
