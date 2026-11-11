/**
 * Testes do motor de domínio. Referência: `main.py`/`api.py` (backend, b16a874).
 *
 * O backend não tem suíte de testes numérica; os valores esperados abaixo saem
 * da fórmula de `PoliticaFila.pontuacao` / `FilaAtendimento.ordenar` e da regra
 * do README ("um caminhão antigo pode ultrapassar um prioritário recente").
 * Os 9 casos da fila reproduzem os números aprovados nos wireframes (206, 70, 55…).
 */
import assert from "node:assert/strict";
import type { CaracteristicaCarga, EstadoCaminhao } from "@/types/terminal";
import { describe, it } from "node:test";
import { executar } from "./acoes";
import { acoesPermitidas, docasCompativeis, filaDe, motivoEspera, restricaoDoca, resumoDoPainel, temposMinutos } from "./derivados";
import { verificarInvariantes } from "./invariantes";
import { POLITICA_PADRAO, TRANSICOES, ordenarFila, pontuacao } from "./regras";
import { ErroDeDominio, type Acao, type EstadoTerminal, type NovaOperacao } from "./tipos";
import { AGORA, FUNC, atras, contextoFixo, naVaga, op, terminalBase } from "./fabrica-teste";

const rodar = (e: EstadoTerminal, a: Acao, ctx = contextoFixo()) => executar(e, a, ctx);
const semViolacoes = (e: EstadoTerminal) => assert.deepEqual(verificarInvariantes(e), []);
const erro = (fn: () => unknown, trecho: RegExp) =>
  assert.throws(fn, (x) => x instanceof ErroDeDominio && trecho.test(x.message));

const chegada = (extra: Partial<NovaOperacao> = {}): NovaOperacao => ({
  nome_motorista: "Ana", documento_motorista: "123", placa: "abc1d23", transportadora: "LogMar",
  descricao_carga: "Paletes", caracteristicas: ["comum"], tipo: "descarga",
  documentacao_regular: false, exige_inspecao: false, ...extra,
});

describe("política da fila (PoliticaFila + FilaAtendimento)", () => {
  it("pesos padrão e bônus de 0,5 ponto por minuto", () => {
    assert.deepEqual(POLITICA_PADRAO, {
      pesos: { prioritária: 100, perigosa: 50, refrigerada: 30, frágil: 20 },
      bonus_por_minuto: 0.5,
    });
  });

  it("pontuação = soma dos pesos + minutos × 0,5 (comum não pontua)", () => {
    assert.equal(pontuacao(POLITICA_PADRAO, ["comum"], atras(0), AGORA), 0);
    assert.equal(pontuacao(POLITICA_PADRAO, ["prioritária"], atras(0), AGORA), 100);
    assert.equal(pontuacao(POLITICA_PADRAO, ["perigosa", "prioritária"], atras(112), AGORA), 206);
    assert.equal(pontuacao(POLITICA_PADRAO, ["refrigerada"], atras(80), AGORA), 70);
    assert.equal(pontuacao(POLITICA_PADRAO, ["comum"], atras(41), AGORA), 20.5);
  });

  it("espera negativa (chegada no futuro) conta como zero", () => {
    assert.equal(pontuacao(POLITICA_PADRAO, ["comum"], new Date(AGORA.getTime() + 60_000).toISOString(), AGORA), 0);
  });

  it("um caminhão antigo ultrapassa um prioritário recente", () => {
    const antigo = op("NO_PATIO", { chegadaMin: 220 }); // 110 pontos
    const prioritario = op("NO_PATIO", { chegadaMin: 0, caracteristicas: ["prioritária"] }); // 100
    const ordem = ordenarFila([prioritario, antigo], POLITICA_PADRAO, AGORA);
    assert.deepEqual(ordem.map((i) => i.operacao.id), [antigo.id, prioritario.id]);
    // com 180 min (90 pontos) ainda não ultrapassa
    const quaseAntigo = op("NO_PATIO", { chegadaMin: 180 });
    assert.equal(ordenarFila([quaseAntigo, prioritario], POLITICA_PADRAO, AGORA)[0].operacao.id, prioritario.id);
  });

  it("empate de pontuação é decidido pela chegada mais antiga", () => {
    const fragilRecente = op("NO_PATIO", { chegadaMin: 0, caracteristicas: ["frágil"] }); // 20
    const comumAntigo = op("NO_PATIO", { chegadaMin: 40 }); // 20
    const ordem = ordenarFila([fragilRecente, comumAntigo], POLITICA_PADRAO, AGORA);
    assert.deepEqual(ordem.map((i) => i.operacao.id), [comumAntigo.id, fragilRecente.id]);
  });

  it("só entram AGUARDANDO_ENTRADA, NO_PATIO e AGUARDANDO_RECURSO", () => {
    const estados = [
      "AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "NO_PATIO",
      "AGUARDANDO_RECURSO", "EM_OPERACAO", "AGUARDANDO_LIBERACAO", "FINALIZADO",
    ] as const;
    const ordem = ordenarFila(estados.map((s) => op(s)), POLITICA_PADRAO, AGORA);
    assert.deepEqual(
      ordem.map((i) => i.operacao.estado).sort(),
      ["AGUARDANDO_ENTRADA", "AGUARDANDO_RECURSO", "NO_PATIO"],
    );
  });

  it("reproduz a fila dos wireframes (206, 70, 55, 24, 20,5, 17,5, 6, 4,5, 2)", () => {
    const e = terminalBase();
    const casos: Array<[string, EstadoCaminhao, number, CaracteristicaCarga[]]> = [
      ["FGH", "AGUARDANDO_RECURSO", 112, ["perigosa", "prioritária"]],
      ["KLM", "AGUARDANDO_RECURSO", 80, ["refrigerada"]],
      ["VWX", "AGUARDANDO_RECURSO", 110, ["comum"]],
      ["BRA", "AGUARDANDO_RECURSO", 48, ["comum"]],
      ["NOP", "AGUARDANDO_RECURSO", 41, ["comum"]],
      ["RIO", "NO_PATIO", 35, ["comum"]],
      ["TPN", "NO_PATIO", 12, ["comum"]],
      ["UVW", "AGUARDANDO_ENTRADA", 9, ["comum"]],
      ["XYZ", "AGUARDANDO_ENTRADA", 4, ["comum"]],
    ];
    e.operacoes = casos.map(([, estado, min, car]) => op(estado, { chegadaMin: min, caracteristicas: car }));
    const fila = filaDe(e, AGORA);
    assert.deepEqual(fila.map((i) => i.pontuacao), [206, 70, 55, 24, 20.5, 17.5, 6, 4.5, 2]);
    assert.deepEqual(fila.map((i) => i.posicao), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // fatores: uma linha por característica (ordem alfabética) + tempo de espera
    assert.deepEqual(fila[0].fatores, [
      { tipo: "caracteristica", caracteristica: "perigosa", peso: 50 },
      { tipo: "caracteristica", caracteristica: "prioritária", peso: 100 },
      { tipo: "tempo_espera", minutos: 112, bonus_por_minuto: 0.5, pontos: 56 },
    ]);
  });

  it("recalcula a fila quando o relógio avança", () => {
    const a = op("NO_PATIO", { chegadaMin: 0, caracteristicas: ["prioritária"] });
    const b = op("NO_PATIO", { chegadaMin: 150 }); // 75 hoje
    const antes = ordenarFila([a, b], POLITICA_PADRAO, AGORA);
    assert.equal(antes[0].operacao.id, a.id);
    const depois = ordenarFila([a, b], POLITICA_PADRAO, new Date(AGORA.getTime() + 100 * 60_000));
    // a: 100 + 50 = 150; b: 75 + 50 = 125 → continua a, mas a diferença diminuiu
    assert.equal(depois[0].pontuacao - depois[1].pontuacao, 25);
  });
});

describe("máquina de estados (TRANSICOES)", () => {
  it("espelha as transições do back-end", () => {
    assert.deepEqual(TRANSICOES.AGUARDANDO_DOCUMENTACAO, ["AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "AGUARDANDO_LIBERACAO"]);
    assert.deepEqual(TRANSICOES.EM_OPERACAO, ["AGUARDANDO_RECURSO", "AGUARDANDO_LIBERACAO"]);
    assert.deepEqual(TRANSICOES.AGUARDANDO_LIBERACAO, ["FINALIZADO"]);
    assert.deepEqual(TRANSICOES.FINALIZADO, []);
  });

  it("ações permitidas por estado", () => {
    assert.deepEqual(acoesPermitidas(op("AGUARDANDO_DOCUMENTACAO")), ["documentation", "cancel"]);
    assert.deepEqual(acoesPermitidas(op("NO_PATIO")), ["start", "interrupt", "cancel"]);
    assert.deepEqual(acoesPermitidas(op("EM_OPERACAO")), ["finish", "interrupt"]);
    assert.deepEqual(acoesPermitidas(op("FINALIZADO")), []);
  });
});

describe("chegada (FabricaOperacao)", () => {
  it("estado inicial depende da documentação e da inspeção", () => {
    const e = terminalBase();
    const estadoDe = (n: Partial<NovaOperacao>) => {
      const r = rodar(e, { tipo: "criar-operacao", dados: chegada(n) });
      return r.estado.operacoes.find((o) => o.id === r.resultado.operacaoId)!.estado;
    };
    assert.equal(estadoDe({ documentacao_regular: false }), "AGUARDANDO_DOCUMENTACAO");
    assert.equal(estadoDe({ documentacao_regular: true, exige_inspecao: true }), "AGUARDANDO_INSPECAO");
    assert.equal(estadoDe({ documentacao_regular: true }), "AGUARDANDO_ENTRADA");
  });

  it("exige motorista, documento, placa, transportadora, carga e ao menos uma característica", () => {
    const e = terminalBase();
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ placa: " " }) }), /Informe a placa/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ nome_motorista: " " }) }), /nome do motorista/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ documento_motorista: "" }) }), /documento do motorista/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ transportadora: "" }) }), /transportadora/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ descricao_carga: "" }) }), /descrição da carga/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ caracteristicas: [] }) }), /característica/);
  });

  it("normaliza a placa e reaproveita o caminhão já cadastrado", () => {
    let r = rodar(terminalBase(), { tipo: "criar-operacao", dados: chegada() });
    const primeira = r.estado.operacoes[0];
    assert.equal(primeira.caminhao.placa, "ABC-1D23");
    r = rodar(r.estado, { tipo: "criar-operacao", dados: chegada({ nome_motorista: "Outro" }) });
    assert.equal(r.estado.operacoes.length, 2);
    assert.equal(r.estado.operacoes[1].caminhao.id, primeira.caminhao.id);
  });

  it("não altera o estado recebido", () => {
    const e = terminalBase();
    const antes = structuredClone(e);
    rodar(e, { tipo: "criar-operacao", dados: chegada() });
    assert.deepEqual(e, antes);
  });
});

describe("documentação e inspeção", () => {
  it("documentação regular avança para AGUARDANDO_ENTRADA e registra o responsável", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_DOCUMENTACAO", { documentacao_regular: false });
    e.operacoes = [o];
    const r = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: true });
    const novo = r.estado.operacoes[0];
    assert.equal(novo.estado, "AGUARDANDO_ENTRADA");
    assert.equal(novo.documentacao_regular, true);
    assert.equal(novo.historico.at(-1)?.tipo, "MUDANCA_ESTADO");
    assert.equal(novo.historico.at(-1)?.responsavel_id, FUNC.recepcao.id);
    semViolacoes(r.estado);
  });

  it("documentação irregular gera ocorrência e mantém a etapa", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_DOCUMENTACAO");
    e.operacoes = [o];
    const r = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: false });
    assert.equal(r.estado.operacoes[0].estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(r.estado.ocorrencias.length, 1);
    assert.equal(r.estado.ocorrencias[0].tipo, "DOCUMENTACAO_IRREGULAR");
    assert.equal(r.estado.ocorrencias[0].estado, "ABERTA");
  });

  it("só valida documentação na triagem", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    erro(() => rodar(e, { tipo: "documentation", operacaoId: o.id, regular: true }), /triagem/);
  });

  it("inspeção aprovada vai para AGUARDANDO_ENTRADA; reprovada volta à documentação", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_INSPECAO");
    e.operacoes = [o];
    const ok = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "Sem avarias", aprovado: true });
    assert.equal(ok.estado.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    assert.equal(ok.estado.operacoes[0].inspecoes.length, 1);
    assert.equal(ok.estado.operacoes[0].historico.some((h) => h.tipo === "INSPECAO"), true);
    const nok = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "Lacre rompido", aprovado: false });
    assert.equal(nok.estado.operacoes[0].estado, "AGUARDANDO_DOCUMENTACAO");
  });

  it("inspeção exige resultado e estado correto", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_INSPECAO");
    const p = op("NO_PATIO");
    e.operacoes = [o, p];
    erro(() => rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: " ", aprovado: true }), /resultado/);
    erro(() => rodar(e, { tipo: "inspection", operacaoId: p.id, resultado: "ok", aprovado: true }), /aguardando inspeção/);
  });
});

describe("autorizar entrada (ServicoDominioTerminal.autorizar_entrada)", () => {
  const cenario = (car: CaracteristicaCarga[] = ["comum"]) => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA", { caracteristicas: car });
    e.operacoes = [o];
    return { e, o, vaga: (c: string) => e.vagas.find((v) => v.codigo === c)!.id };
  };

  it("ocupa a vaga e leva o caminhão ao pátio", () => {
    const { e, o, vaga } = cenario();
    const r = rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V01") });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "NO_PATIO");
    assert.equal(n.vaga_id, vaga("V01"));
    assert.equal(r.estado.vagas[0].estado, "OCUPADO");
    assert.equal(r.estado.vagas[0].operacao_id, o.id);
    assert.deepEqual(n.historico.map((h) => h.tipo), ["ALOCACAO_RECURSO", "MUDANCA_ESTADO"]);
    semViolacoes(r.estado);
  });

  it("carga refrigerada só entra em área refrigerada", () => {
    const { e, o, vaga } = cenario(["refrigerada"]);
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V01") }), /inadequada/);
    assert.equal(rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V05") }).estado.operacoes[0].estado, "NO_PATIO");
  });

  it("carga perigosa só entra em área autorizada", () => {
    const { e, o, vaga } = cenario(["perigosa"]);
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V01") }), /inadequada/);
    assert.equal(rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V06") }).estado.operacoes[0].estado, "NO_PATIO");
  });

  it("vaga de área interditada ou já ocupada é recusada", () => {
    const { e, o, vaga } = cenario();
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V07") }), /inadequada/);
    const outra = op("NO_PATIO");
    e.operacoes.push(outra);
    naVaga(e, outra, "V01");
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: vaga("V01") }), /inadequada/);
  });

  it("recusa fora da etapa e deixa o estado intacto", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_INSPECAO");
    e.operacoes = [o];
    const antes = structuredClone(e);
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[0].id }), /liberada para entrada/);
    assert.deepEqual(e, antes);
  });
});

describe("iniciar operação (AlocadorDeRecursos.alocar_e_iniciar)", () => {
  const noPatio = (car: CaracteristicaCarga[] = ["comum"], vaga = "V01", tipo: "carga" | "descarga" = "descarga") => {
    const e = terminalBase();
    const o = op("NO_PATIO", { caracteristicas: car, tipo });
    e.operacoes = [o];
    naVaga(e, o, vaga);
    return { e, o };
  };

  it("aloca vaga, doca e equipamento e inicia", () => {
    const { e, o } = noPatio();
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    const n = r.estado.operacoes[0];
    assert.equal(r.resultado.iniciada, true);
    assert.equal(n.estado, "EM_OPERACAO");
    assert.ok(n.doca_id && n.equipamento_id && n.vaga_id);
    assert.equal(n.iniciada_em, AGORA.toISOString());
    assert.equal(n.funcionario_responsavel_id, FUNC.operador.id);
    // NO_PATIO → AGUARDANDO_RECURSO → EM_OPERACAO (divergência do backend; ver comentário em acoes.ts)
    assert.deepEqual(n.historico.map((h) => h.estado_novo), ["AGUARDANDO_RECURSO", null, "EM_OPERACAO", null]);
    assert.deepEqual(n.historico.map((h) => h.tipo), ["MUDANCA_ESTADO", "ALOCACAO_RECURSO", "MUDANCA_ESTADO", "OPERACAO_INICIADA"]);
    assert.equal(r.estado.docas.find((d) => d.id === n.doca_id)!.estado, "OCUPADO");
    assert.equal(r.estado.equipamentos.find((q) => q.id === n.equipamento_id)!.estado, "OCUPADO");
    semViolacoes(r.estado);
  });

  it("sem conjunto completo não reserva nada e passa a AGUARDANDO_RECURSO", () => {
    const { e, o } = noPatio();
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    assert.equal(r.resultado.iniciada, false);
    assert.equal(r.estado.operacoes[0].estado, "AGUARDANDO_RECURSO");
    assert.equal(r.estado.operacoes[0].doca_id, null);
    assert.equal(r.estado.docas.every((d) => d.estado === "LIVRE"), true);
    semViolacoes(r.estado);
    // liberado o equipamento, a mesma operação consegue iniciar a partir de AGUARDANDO_RECURSO
    r.estado.equipamentos[0].estado = "DISPONIVEL";
    const r2 = rodar(r.estado, { tipo: "start", operacaoId: o.id });
    assert.equal(r2.estado.operacoes[0].estado, "EM_OPERACAO");
    semViolacoes(r2.estado);
  });

  it("carga frágil exige equipamento que aceite carga frágil", () => {
    const { e, o } = noPatio(["frágil"]);
    const r = rodar(e, { tipo: "start", operacaoId: o.id });
    assert.equal(r.estado.operacoes[0].equipamento_id, e.equipamentos[1].id); // EQ-02 aceita frágil
    const e2 = structuredClone(e);
    e2.equipamentos[1].estado = "EM_MANUTENCAO";
    assert.equal(rodar(e2, { tipo: "start", operacaoId: o.id }).resultado.iniciada, false);
  });

  it("carga refrigerada usa doca em área refrigerada; perigosa, em área autorizada", () => {
    const a = noPatio(["refrigerada"], "V05");
    const ra = rodar(a.e, { tipo: "start", operacaoId: a.o.id });
    assert.equal(ra.estado.docas.find((d) => d.id === ra.estado.operacoes[0].doca_id)!.codigo, "D2");
    const b = noPatio(["perigosa"], "V06");
    const rb = rodar(b.e, { tipo: "start", operacaoId: b.o.id });
    assert.equal(rb.estado.docas.find((d) => d.id === rb.estado.operacoes[0].doca_id)!.codigo, "D3");
    semViolacoes(ra.estado);
    semViolacoes(rb.estado);
  });

  it("doca com tipo próprio só recebe operação do mesmo tipo", () => {
    const { e, o } = noPatio(["comum"], "V01", "descarga");
    e.docas = e.docas.filter((d) => d.codigo === "D4"); // só aceita carga
    assert.equal(rodar(e, { tipo: "start", operacaoId: o.id }).resultado.iniciada, false);
    o.tipo = "carga";
    assert.equal(rodar(e, { tipo: "start", operacaoId: o.id }).resultado.iniciada, true);
  });

  it("exige operador habilitado ao tipo da operação", () => {
    const { e, o } = noPatio();
    e.funcionarios.find((f) => f.funcao === "OPERADOR")!.habilitacoes = ["carga"]; // operação é de descarga
    erro(() => rodar(e, { tipo: "start", operacaoId: o.id }), /habilitado/);
  });

  it("só inicia a partir de NO_PATIO ou AGUARDANDO_RECURSO", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    erro(() => rodar(e, { tipo: "start", operacaoId: o.id }), /pátio ou aguardando recurso/);
  });
});

describe("interromper, finalizar, liberar e cancelar", () => {
  const emOperacao = (car: CaracteristicaCarga[] = ["comum"]) => {
    const e = terminalBase();
    const o = op("NO_PATIO", { caracteristicas: car });
    e.operacoes = [o];
    naVaga(e, o, "V01");
    return { e: rodar(e, { tipo: "start", operacaoId: o.id }).estado, id: o.id };
  };

  it("interromper: libera doca e equipamento, mantém a vaga e abre ocorrência", () => {
    const { e, id } = emOperacao();
    const docaId = e.operacoes[0].doca_id;
    const r = rodar(e, {
      tipo: "interrupt", operacaoId: id, descricao: "Operador ausente", equipamentoQuebrado: false,
      severidade: "media", impacto: "operacao", recurso: { tipo: "doca", id: docaId! },
    });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_RECURSO");
    assert.equal(n.doca_id, null);
    assert.equal(n.equipamento_id, null);
    assert.ok(n.vaga_id);
    assert.equal(r.estado.docas.find((d) => d.id === docaId)!.estado, "LIVRE"); // interrupção não é estado da doca
    assert.equal(r.estado.vagas[0].estado, "OCUPADO");
    assert.equal(n.interrupcao?.doca_id, docaId);
    assert.equal(r.estado.ocorrencias.length, 1);
    assert.equal(r.estado.ocorrencias[0].estado, "ABERTA");
    semViolacoes(r.estado);
  });

  it("equipamento quebrado deixa o equipamento em manutenção", () => {
    const { e, id } = emOperacao();
    const eqId = e.operacoes[0].equipamento_id!;
    const r = rodar(e, {
      tipo: "interrupt", operacaoId: id, descricao: "Quebrou", equipamentoQuebrado: true,
      severidade: "critica", impacto: "recurso", recurso: { tipo: "equipment", id: eqId },
    });
    assert.equal(r.estado.equipamentos.find((q) => q.id === eqId)!.estado, "EM_MANUTENCAO");
    assert.equal(r.estado.ocorrencias[0].tipo, "EQUIPAMENTO_QUEBRADO");
    semViolacoes(r.estado);
  });

  it("interromper exige descrição, recurso existente e etapa adequada", () => {
    const { e, id } = emOperacao();
    const base = { tipo: "interrupt" as const, operacaoId: id, equipamentoQuebrado: false, severidade: "media" as const, impacto: "operacao" as const };
    erro(() => rodar(e, { ...base, descricao: " " }), /descrição/);
    erro(() => rodar(e, { ...base, descricao: "x", recurso: { tipo: "doca", id: "inexistente" } }), /Recurso não encontrado/);
    const o = op("AGUARDANDO_DOCUMENTACAO");
    e.operacoes.push(o);
    erro(() => rodar(e, { ...base, operacaoId: o.id, descricao: "x" }), /pátio ou em andamento/);
  });

  it("finalizar libera tudo e leva a AGUARDANDO_LIBERACAO; liberar finaliza", () => {
    const { e, id } = emOperacao();
    const f = rodar(e, { tipo: "finish", operacaoId: id });
    const n = f.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_LIBERACAO");
    assert.equal(n.finalizada_em, AGORA.toISOString());
    assert.deepEqual([n.vaga_id, n.doca_id, n.equipamento_id], [null, null, null]);
    assert.equal(f.estado.vagas.every((v) => v.estado === "LIVRE"), true);
    assert.equal(f.estado.equipamentos.every((q) => q.estado === "DISPONIVEL"), true);
    semViolacoes(f.estado);
    const l = rodar(f.estado, { tipo: "release", operacaoId: id });
    assert.equal(l.estado.operacoes[0].estado, "FINALIZADO");
    semViolacoes(l.estado);
    erro(() => rodar(l.estado, { tipo: "release", operacaoId: id }), /aguardando liberação/);
  });

  it("finalizar exige operação em andamento", () => {
    const e = terminalBase();
    const o = op("NO_PATIO");
    e.operacoes = [o];
    erro(() => rodar(e, { tipo: "finish", operacaoId: o.id }), /em andamento/);
  });

  it("cancelar exige motivo, libera recursos e vai a AGUARDANDO_LIBERACAO", () => {
    const e = terminalBase();
    const o = op("NO_PATIO");
    e.operacoes = [o];
    naVaga(e, o, "V01");
    erro(() => rodar(e, { tipo: "cancel", operacaoId: o.id, motivo: " " }), /motivo/);
    const r = rodar(e, { tipo: "cancel", operacaoId: o.id, motivo: "Desistência do motorista" });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_LIBERACAO");
    assert.equal(n.cancelada, true);
    assert.equal(n.vaga_id, null);
    assert.equal(r.estado.vagas[0].estado, "LIVRE");
    assert.equal(r.estado.ocorrencias[0].tipo, "CANCELAMENTO");
    semViolacoes(r.estado);
  });

  it("não cancela operação aguardando liberação ou finalizada", () => {
    const e = terminalBase();
    const a = op("AGUARDANDO_LIBERACAO");
    const b = op("FINALIZADO");
    e.operacoes = [a, b];
    erro(() => rodar(e, { tipo: "cancel", operacaoId: a.id, motivo: "x" }), /não pode ser cancelada/);
    erro(() => rodar(e, { tipo: "cancel", operacaoId: b.id, motivo: "x" }), /não pode ser cancelada/);
  });
});

describe("ocorrências, manutenção e interdição (supervisão)", () => {
  it("resolver ocorrência marca resolvida sem mexer em operação ou recursos", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_DOCUMENTACAO");
    e.operacoes = [o];
    const r1 = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: false });
    const ocId = r1.estado.ocorrencias[0].id;
    const r2 = rodar(r1.estado, { tipo: "resolve-occurrence", ocorrenciaId: ocId });
    assert.equal(r2.estado.ocorrencias[0].estado, "RESOLVIDA");
    assert.equal(r2.estado.ocorrencias[0].resolvida_por, FUNC.supervisor.id);
    assert.equal(r2.estado.operacoes[0].estado, r1.estado.operacoes[0].estado);
    erro(() => rodar(r2.estado, { tipo: "resolve-occurrence", ocorrenciaId: ocId }), /já está resolvida/);
  });

  it("manutenção não altera recurso ocupado; libera e coloca em manutenção os livres", () => {
    const e = terminalBase();
    const o = op("NO_PATIO");
    e.operacoes = [o];
    naVaga(e, o, "V01");
    erro(() => rodar(e, { tipo: "maintenance", recurso: { tipo: "vaga", id: e.vagas[0].id }, emManutencao: true }), /ocupado/);
    const dentro = rodar(e, { tipo: "maintenance", recurso: { tipo: "equipment", id: e.equipamentos[0].id }, emManutencao: true });
    assert.equal(dentro.estado.equipamentos[0].estado, "EM_MANUTENCAO");
    const fora = rodar(dentro.estado, { tipo: "maintenance", recurso: { tipo: "equipment", id: e.equipamentos[0].id }, emManutencao: false });
    assert.equal(fora.estado.equipamentos[0].estado, "DISPONIVEL");
    const doca = rodar(e, { tipo: "maintenance", recurso: { tipo: "doca", id: e.docas[0].id }, emManutencao: true });
    assert.equal(doca.estado.docas[0].estado, "EM_MANUTENCAO");
    assert.equal(rodar(doca.estado, { tipo: "maintenance", recurso: { tipo: "doca", id: e.docas[0].id }, emManutencao: false }).estado.docas[0].estado, "LIVRE");
  });

  it("interdição não é permitida com recurso ocupado na área", () => {
    const e = terminalBase();
    const o = op("NO_PATIO");
    e.operacoes = [o];
    naVaga(e, o, "V01");
    erro(() => rodar(e, { tipo: "area-interdicao", areaId: e.areas[0].id, interditada: true }), /Libere os recursos ocupados/);
    const r = rodar(e, { tipo: "area-interdicao", areaId: e.areas[1].id, interditada: true, motivo: "inspeção" });
    assert.equal(r.estado.areas[1].interditada, true);
    assert.equal(r.estado.areas[1].motivo_interdicao, "inspeção");
    const volta = rodar(r.estado, { tipo: "area-interdicao", areaId: e.areas[1].id, interditada: false });
    assert.equal(volta.estado.areas[1].interditada, false);
    assert.equal(volta.estado.areas[1].motivo_interdicao, null);
  });
});

describe("fluxo completo e consistência", () => {
  it("chegada → documentação → inspeção → entrada → operação → finalização → liberação", () => {
    let ctxId = 9000;
    const ctx = { agora: AGORA, novoId: () => `00000000-0000-4000-8000-${String(ctxId++).padStart(12, "0")}` };
    let e = terminalBase();
    let r = executar(e, { tipo: "criar-operacao", dados: chegada({ caracteristicas: ["refrigerada", "prioritária"], tipo: "carga" }) }, ctx);
    const id = r.resultado.operacaoId!;
    e = r.estado; semViolacoes(e);
    for (const a of [
      { tipo: "documentation", operacaoId: id, regular: true },
      { tipo: "yard-entry", operacaoId: id, vagaId: e.vagas[4].id }, // V05 refrigerada
      { tipo: "start", operacaoId: id },
      { tipo: "finish", operacaoId: id },
      { tipo: "release", operacaoId: id },
    ] as Acao[]) {
      r = executar(e, a, ctx);
      e = r.estado;
      semViolacoes(e);
    }
    const final = e.operacoes[0];
    assert.equal(final.estado, "FINALIZADO");
    assert.equal(final.historico.filter((h) => h.tipo === "MUDANCA_ESTADO").length, 6);
    assert.equal(e.vagas.every((v) => v.estado === "LIVRE"), true);
    assert.equal(e.docas.every((d) => d.estado === "LIVRE"), true);
  });

  it("erros não deixam efeito parcial no estado", () => {
    const e = terminalBase();
    const o = op("NO_PATIO");
    e.operacoes = [o];
    naVaga(e, o, "V01");
    e.funcionarios.find((f) => f.funcao === "OPERADOR")!.habilitacoes = [];
    const antes = structuredClone(e);
    assert.throws(() => rodar(e, { tipo: "start", operacaoId: o.id }), ErroDeDominio);
    assert.deepEqual(e, antes);
  });
});

describe("derivados (tempos, painel, textos explicativos)", () => {
  it("tempos_minutos segue api.py", () => {
    const parada = op("AGUARDANDO_ENTRADA", { chegadaMin: 30 });
    assert.deepEqual(temposMinutos(parada, AGORA), { espera: 30, operacao: 0 });
    const andamento = op("EM_OPERACAO", { chegadaMin: 90, iniciada_em: atras(40) });
    assert.deepEqual(temposMinutos(andamento, AGORA), { espera: 50, operacao: 40 });
    const pronta = op("AGUARDANDO_LIBERACAO", { chegadaMin: 90, iniciada_em: atras(40), finalizada_em: atras(10) });
    assert.deepEqual(temposMinutos(pronta, AGORA), { espera: 50, operacao: 30 });
  });

  it("contagens do painel acompanham operações e recursos", () => {
    const e = terminalBase();
    e.operacoes = [op("NO_PATIO"), op("NO_PATIO"), op("FINALIZADO")];
    naVaga(e, e.operacoes[0], "V01");
    e.equipamentos[1].estado = "EM_MANUTENCAO";
    const r = resumoDoPainel(e);
    assert.equal(r.total_operacoes, 3);
    assert.equal(r.por_estado.NO_PATIO, 2);
    assert.equal(r.recursos.vagas.OCUPADO, 1);
    assert.equal(r.recursos.vagas.LIVRE, 6);
    assert.equal(r.recursos.equipamentos.EM_MANUTENCAO, 1);
    assert.equal(r.recursos.equipamentos.DISPONIVEL, 1);
  });

  it("motivo de espera descreve o estado dos recursos", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_RECURSO", { caracteristicas: ["refrigerada"] });
    e.operacoes = [o];
    naVaga(e, o, "V05");
    e.docas[1].estado = "EM_MANUTENCAO"; // única doca refrigerada
    assert.equal(motivoEspera(e, o), "Sem doca refrigerada livre; D2 em manutenção");

    const c = op("AGUARDANDO_RECURSO");
    e.operacoes.push(c);
    naVaga(e, c, "V01");
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    assert.equal(motivoEspera(e, c), "Aguarda EQ-01 e EQ-02 (em manutenção)");
    e.ocorrencias.push({
      id: "oc", tipo: "EQUIPAMENTO_QUEBRADO", descricao: "", responsavel_id: FUNC.operador.id, criada_em: atras(5),
      estado: "ABERTA", resolvida_em: null, resolvida_por: null, severidade: "critica", impacto: "recurso",
      recurso_tipo: "equipment", recurso_id: e.equipamentos[0].id, operacao_id: c.id,
      titulo: null, operacoes_afetadas: null, metrica_rotulo: null,
    });
    e.equipamentos[1].estado = "OCUPADO";
    assert.equal(motivoEspera(e, c), "Aguarda EQ-01 (quebrado)");
    assert.equal(motivoEspera(e, op("AGUARDANDO_ENTRADA")), null);
  });

  it("restrição de doca e docas compatíveis só descrevem o estado atual", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_RECURSO");
    e.operacoes = [o];
    naVaga(e, o, "V01");
    e.equipamentos.forEach((q) => (q.estado = "EM_MANUTENCAO"));
    const r = restricaoDoca(e, e.docas[0]);
    assert.equal(r?.codigo, "SEM_EQUIPAMENTO_COMPATIVEL");
    assert.match(r!.texto, /EQ-01 e EQ-02 estão em manutenção/);
    const lista = docasCompativeis(e, o).docas;
    assert.ok(lista.length > 0);
    assert.equal(lista.every((d) => d.disponivel === false), true);
    e.equipamentos[0].estado = "DISPONIVEL";
    assert.equal(restricaoDoca(e, e.docas[0]), null);
    assert.equal(docasCompativeis(e, o).docas.some((d) => d.disponivel), true);
  });
});

describe("invariantes", () => {
  it("detecta recurso indevido, vínculo assimétrico e carga em área inadequada", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_LIBERACAO", { caracteristicas: ["refrigerada"] });
    e.operacoes = [o];
    naVaga(e, o, "V01"); // aguardando liberação não pode ocupar vaga; e vaga é inadequada
    const codigos = verificarInvariantes(e).map((v) => v.codigo);
    assert.ok(codigos.includes("RECURSO_INDEVIDO"));
    assert.ok(codigos.includes("VAGA_INADEQUADA"));
    e.vagas[0].operacao_id = null; // quebra o vínculo
    assert.ok(verificarInvariantes(e).some((v) => v.codigo === "RECURSO_ORFAO"));
  });

  it("detecta operação em andamento sem os recursos exigidos", () => {
    const e = terminalBase();
    const o = op("EM_OPERACAO", { iniciada_em: atras(5) });
    e.operacoes = [o];
    const codigos = verificarInvariantes(e).map((v) => v.codigo);
    assert.equal(codigos.filter((c) => c === "RECURSO_AUSENTE").length, 3);
  });
});
