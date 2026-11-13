/**
 * Etapa 2 do MVP: chegada, documentação, inspeção, entrada no pátio e fila.
 * Referência: `main.py` / `api.py` (backend, b16a874). Cada teste diz de qual
 * regra do backend vem o comportamento esperado; o que for hipótese do front
 * está marcado como tal.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarCenarioInicial } from "@/mocks/cenario";
import { montarTerminal } from "@/store/selecionar";
import { executar } from "./acoes";
import { acoesPermitidas, caminhaoPorPlaca, etapaDesdeOperacao, filaDe, resumoDoPainel, vagasParaEntrada } from "./derivados";
import { AGORA, FUNC, contextoFixo, naVaga, op, terminalBase } from "./fabrica-teste";
import { verificarInvariantes } from "./invariantes";
import { estadoInicial, motivoVagaIndisponivel, vagaAdequada } from "./regras";
import { ErroDeDominio, type Acao, type EstadoTerminal, type NovaOperacao } from "./tipos";
import { normalizarPlaca, primeiroErro, validarNovaOperacao } from "./validacao";

const rodar = (e: EstadoTerminal, a: Acao, ctx = contextoFixo()) => executar(e, a, ctx);
const semViolacoes = (e: EstadoTerminal) => assert.deepEqual(verificarInvariantes(e), []);
const erro = (fn: () => unknown, trecho: RegExp) =>
  assert.throws(fn, (x) => x instanceof ErroDeDominio && trecho.test(x.message));

const chegada = (extra: Partial<NovaOperacao> = {}): NovaOperacao => ({
  nome_motorista: "Ana Souza", documento_motorista: "123456", placa: "ABC-1D23", transportadora: "LogMar",
  descricao_carga: "Paletes de bebidas", caracteristicas: ["comum"], tipo: "descarga",
  documentacao_regular: false, exige_inspecao: false, ...extra,
});

const vazio = { ...chegada(), nome_motorista: "", documento_motorista: "", placa: "", transportadora: "", descricao_carga: "", caracteristicas: [] };

describe("validação do registro de chegada", () => {
  it("dados completos não têm erro", () => {
    assert.deepEqual(validarNovaOperacao(chegada()), {});
  });

  it("campos obrigatórios ausentes: um erro por campo, na ordem do formulário", () => {
    const erros = validarNovaOperacao({ ...vazio, tipo: "" });
    assert.deepEqual(Object.keys(erros).sort(), [
      "caracteristicas", "descricao_carga", "documento_motorista", "nome_motorista", "placa", "tipo", "transportadora",
    ]);
    assert.equal(primeiroErro(erros), "Informe a placa do caminhão.");
  });

  it("texto só com espaços conta como vazio (o backend aplica strip)", () => {
    const erros = validarNovaOperacao(chegada({ nome_motorista: "   ", transportadora: "\t" }));
    assert.deepEqual(Object.keys(erros).sort(), ["nome_motorista", "transportadora"]);
  });

  it("placa: o backend só exige preenchimento; qualquer grafia preenchida é aceita (inclusive estrangeira)", () => {
    for (const ok of ["ABC-1234", "abc1234", "ABC1D23", "abc-1d23", " abc 1d23 ", "AB123CD", "ABC-12", "12-34"]) {
      assert.equal(validarNovaOperacao(chegada({ placa: ok })).placa, undefined, ok);
    }
    assert.equal(validarNovaOperacao(chegada({ placa: "   " })).placa, "Informe a placa do caminhão.");
    assert.match(validarNovaOperacao(chegada({ placa: "A".repeat(13) })).placa!, /no máximo 12/);
  });

  it("normaliza a placa para AAA-1A23, o formato do cenário inicial (só exibição e busca)", () => {
    assert.equal(normalizarPlaca("abc1d23"), "ABC-1D23");
    assert.equal(normalizarPlaca(" abc-1234 "), "ABC-1234");
    assert.equal(normalizarPlaca("ABC 1D23"), "ABC-1D23");
    assert.equal(normalizarPlaca("xx"), "XX"); // fora do padrão brasileiro: só maiúsculas, sem espaços
    assert.equal(normalizarPlaca("ab 123 cd"), "AB123CD"); // placa estrangeira não ganha hífen
  });

  it("toda placa do cenário inicial já está na grafia normalizada", () => {
    const e = criarCenarioInicial(AGORA);
    const fora = e.operacoes.map((o) => o.caminhao.placa).filter((p) => normalizarPlaca(p) !== p);
    assert.deepEqual(fora, []);
  });

  it("tamanho máximo dos textos protege o layout", () => {
    assert.match(validarNovaOperacao(chegada({ nome_motorista: "x".repeat(81) })).nome_motorista!, /no máximo 80/);
    assert.match(validarNovaOperacao(chegada({ descricao_carga: "x".repeat(121) })).descricao_carga!, /no máximo 120/);
  });

  it("tipo precisa ser carga ou descarga", () => {
    assert.match(validarNovaOperacao({ ...chegada(), tipo: "" }).tipo!, /carga ou de descarga/);
  });
});

describe("registrar chegada", () => {
  it("cria a operação com data e hora reais, responsável da recepção e o evento de chegada no histórico", () => {
    const e = terminalBase();
    const r = executar(e, { tipo: "criar-operacao", dados: chegada() }, { agora: new Date("2026-11-10T14:05:30.000Z"), novoId: contextoFixo().novoId });
    const o = r.estado.operacoes[0];
    assert.equal(o.chegada_em, "2026-11-10T14:05:30.000Z");
    assert.equal(o.funcionario_responsavel_id, FUNC.recepcao.id);
    assert.equal(o.estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(o.vaga_id, null);
    assert.equal(o.doca_id, null);
    // O backend não grava evento na chegada; a store registra CHEGADA (evento só do front).
    assert.equal(o.historico.length, 1);
    assert.deepEqual(
      { tipo: o.historico[0].tipo, responsavel_id: o.historico[0].responsavel_id, ocorrido_em: o.historico[0].ocorrido_em },
      { tipo: "CHEGADA", responsavel_id: FUNC.recepcao.id, ocorrido_em: "2026-11-10T14:05:30.000Z" },
    );
    assert.equal(o.historico[0].descricao, "Chegada registrada.");
    assert.equal(o.historico[0].estado_anterior, null);
    assert.equal(o.historico[0].estado_novo, null);
    assert.equal(r.resultado.operacaoId, o.id);
    assert.equal(r.resultado.mensagem, "Chegada registrada: ABC-1D23.");
    semViolacoes(r.estado);
  });

  it("o evento de chegada abre o histórico e não mexe no tempo na etapa", () => {
    const c = contextoFixo(7000);
    const chegou = new Date("2026-11-10T14:00:00.000Z");
    const validou = new Date("2026-11-10T14:07:00.000Z");
    let e = executar(terminalBase(), { tipo: "criar-operacao", dados: chegada() }, { agora: chegou, novoId: c.novoId }).estado;
    const id = e.operacoes[0].id;
    e = executar(e, { tipo: "documentation", operacaoId: id, regular: true }, { agora: validou, novoId: c.novoId }).estado;
    const h = e.operacoes[0].historico;
    assert.deepEqual(h.map((x) => x.tipo), ["CHEGADA", "MUDANCA_ESTADO"]);
    assert.deepEqual(h.map((x) => x.ocorrido_em), [chegou.toISOString(), validou.toISOString()]);
    assert.equal(etapaDesdeOperacao(e.operacoes[0]), validou.toISOString()); // etapa atual = última mudança de estado
    semViolacoes(e);
  });

  it("o evento de chegada chega à interface na forma da API (montarTerminal)", () => {
    const e = rodar(terminalBase(), { tipo: "criar-operacao", dados: chegada() }).estado;
    const t = montarTerminal(e, AGORA);
    const op = t.operacoes.find((o) => o.id === e.operacoes[0].id)!;
    assert.deepEqual(op.historico.map((x) => x.tipo), ["CHEGADA"]);
  });

  it("estado inicial (FabricaOperacao.criar) para as quatro combinações", () => {
    assert.equal(estadoInicial(false, false), "AGUARDANDO_DOCUMENTACAO");
    assert.equal(estadoInicial(false, true), "AGUARDANDO_DOCUMENTACAO"); // inspeção só conta com documentação regular
    assert.equal(estadoInicial(true, true), "AGUARDANDO_INSPECAO");
    assert.equal(estadoInicial(true, false), "AGUARDANDO_ENTRADA");
  });

  it("características repetidas são reduzidas", () => {
    const r = rodar(terminalBase(), { tipo: "criar-operacao", dados: chegada({ caracteristicas: ["perigosa", "perigosa", "frágil"] }) });
    assert.deepEqual(r.estado.operacoes[0].carga.caracteristicas, ["perigosa", "frágil"]);
  });

  it("a mesma placa digitada de outra forma reaproveita o caminhão cadastrado", () => {
    const primeira = rodar(terminalBase(), { tipo: "criar-operacao", dados: chegada({ placa: "ABC1D23" }) });
    assert.equal(primeira.estado.operacoes[0].caminhao.placa, "ABC-1D23");
    const segunda = rodar(primeira.estado, { tipo: "criar-operacao", dados: chegada({ placa: "abc-1d23", nome_motorista: "Outro" }) });
    assert.equal(segunda.estado.operacoes.length, 2);
    assert.equal(segunda.estado.operacoes[1].caminhao.id, primeira.estado.operacoes[0].caminhao.id);
    assert.equal(segunda.estado.operacoes[1].caminhao.motorista.nome, "Ana Souza"); // cadastro existente prevalece
    assert.equal(caminhaoPorPlaca(segunda.estado, "abc1d23")?.id, primeira.estado.operacoes[0].caminhao.id);
    assert.equal(caminhaoPorPlaca(segunda.estado, "ZZZ-9Z99"), null);
  });

  it("dado inválido é recusado e o estado fica intacto", () => {
    const e = terminalBase();
    const antes = structuredClone(e);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ placa: "  " }) }), /Informe a placa/);
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada({ caracteristicas: [] }) }), /característica/);
    assert.deepEqual(e, antes);
  });

  it("sem funcionário da recepção a chegada é recusada com mensagem clara", () => {
    const e = terminalBase();
    e.funcionarios = e.funcionarios.filter((f) => f.funcao !== "RECEPCAO");
    erro(() => rodar(e, { tipo: "criar-operacao", dados: chegada() }), /Nenhum funcionário disponível/);
  });
});

describe("ações permitidas por etapa (acoes_permitidas)", () => {
  it("documentação, inspeção e entrada oferecem a própria ação (e cancelar, fora desta etapa)", () => {
    assert.deepEqual(acoesPermitidas(op("AGUARDANDO_DOCUMENTACAO")), ["documentation", "cancel"]);
    assert.deepEqual(acoesPermitidas(op("AGUARDANDO_INSPECAO")), ["inspection", "cancel"]);
    assert.deepEqual(acoesPermitidas(op("AGUARDANDO_ENTRADA")), ["yard-entry", "cancel"]);
  });

  it("fora da etapa a ação é recusada pelo domínio, não só escondida pela tela", () => {
    const e = terminalBase();
    const etapas = ["AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_INSPECAO", "AGUARDANDO_ENTRADA", "NO_PATIO", "EM_OPERACAO", "FINALIZADO"] as const;
    e.operacoes = etapas.map((s) => op(s));
    const por = (s: string) => e.operacoes.find((o) => o.estado === s)!.id;
    for (const s of etapas) {
      if (s !== "AGUARDANDO_DOCUMENTACAO") erro(() => rodar(e, { tipo: "documentation", operacaoId: por(s), regular: true }), /triagem/);
      if (s !== "AGUARDANDO_INSPECAO") erro(() => rodar(e, { tipo: "inspection", operacaoId: por(s), resultado: "ok", aprovado: true }), /aguardando inspeção/);
      if (s !== "AGUARDANDO_ENTRADA") erro(() => rodar(e, { tipo: "yard-entry", operacaoId: por(s), vagaId: e.vagas[0].id }), /liberada para entrada/);
    }
  });
});

describe("documentação", () => {
  const dados = () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_DOCUMENTACAO", { documentacao_regular: false });
    e.operacoes = [o];
    return { e, o };
  };

  it("regular: AGUARDANDO_ENTRADA, evento de mudança de estado com responsável e horário", () => {
    const { e, o } = dados();
    const r = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: true });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_ENTRADA");
    assert.equal(n.documentacao_regular, true);
    const ev = n.historico.at(-1)!;
    assert.deepEqual([ev.tipo, ev.estado_anterior, ev.estado_novo], ["MUDANCA_ESTADO", "AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_ENTRADA"]);
    assert.equal(ev.responsavel_id, FUNC.recepcao.id);
    assert.equal(ev.ocorrido_em, AGORA.toISOString());
    assert.match(r.resultado.mensagem, /validada\. Aguardando entrada/);
    semViolacoes(r.estado);
  });

  it("regular NÃO passa pela inspeção (validar_documentacao vai direto a AGUARDANDO_ENTRADA)", () => {
    const { e, o } = dados();
    // Mesmo que a chegada tenha pedido inspeção, o backend não usa a transição DOCUMENTACAO → INSPECAO.
    const r = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: true });
    assert.equal(r.estado.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    assert.equal(r.estado.operacoes[0].inspecoes.length, 0);
  });

  it("irregular: abre ocorrência DOCUMENTACAO_IRREGULAR, mantém a etapa e registra o evento", () => {
    const { e, o } = dados();
    const r = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: false });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(n.documentacao_regular, false);
    assert.equal(r.estado.ocorrencias.length, 1);
    const oc = r.estado.ocorrencias[0];
    assert.deepEqual([oc.tipo, oc.estado, oc.operacao_id, oc.responsavel_id], ["DOCUMENTACAO_IRREGULAR", "ABERTA", o.id, FUNC.recepcao.id]);
    assert.equal(oc.criada_em, AGORA.toISOString());
    assert.deepEqual(n.historico.map((h) => h.tipo), ["OCORRENCIA"]);
    assert.match(r.resultado.mensagem, /irregular.*Ocorrência aberta/);
    semViolacoes(r.estado);
  });

  it("depois de irregular ainda é possível validar como regular", () => {
    const { e, o } = dados();
    const irregular = rodar(e, { tipo: "documentation", operacaoId: o.id, regular: false });
    const regular = rodar(irregular.estado, { tipo: "documentation", operacaoId: o.id, regular: true });
    assert.equal(regular.estado.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    assert.equal(regular.estado.ocorrencias[0].estado, "ABERTA"); // resolver a ocorrência é da supervisão (próxima etapa)
  });
});

describe("inspeção", () => {
  const dados = () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_INSPECAO");
    e.operacoes = [o];
    return { e, o };
  };

  it("aprovada: registra a inspeção e avança para AGUARDANDO_ENTRADA", () => {
    const { e, o } = dados();
    const r = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "Sem avarias", aprovado: true });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_ENTRADA");
    assert.deepEqual(n.inspecoes, [{ resultado: "Sem avarias", responsavel_id: FUNC.inspetor.id, realizada_em: AGORA.toISOString() }]);
    assert.deepEqual(n.historico.map((h) => h.tipo), ["INSPECAO", "MUDANCA_ESTADO"]);
    assert.equal(n.historico[0].descricao, "Sem avarias");
    semViolacoes(r.estado);
  });

  it("reprovada: registra a inspeção e volta para AGUARDANDO_DOCUMENTACAO (sem estado novo)", () => {
    const { e, o } = dados();
    const r = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "Lacre rompido", aprovado: false });
    const n = r.estado.operacoes[0];
    assert.equal(n.estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(n.inspecoes.length, 1);
    assert.equal(r.estado.ocorrencias.length, 0); // o backend não abre ocorrência na reprovação
    assert.match(r.resultado.mensagem, /reprovada\. Volta à documentação/);
    semViolacoes(r.estado);
  });

  it("não avança sem o resultado e não deixa rastro da tentativa", () => {
    const { e, o } = dados();
    const antes = structuredClone(e);
    erro(() => rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "   ", aprovado: true }), /resultado da inspeção/);
    assert.deepEqual(e, antes);
  });

  it("reprovada volta à documentação e só depois de validada segue para a entrada", () => {
    const { e, o } = dados();
    const reprovada = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "Pneu irregular", aprovado: false });
    const doc = rodar(reprovada.estado, { tipo: "documentation", operacaoId: o.id, regular: true });
    assert.equal(doc.estado.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    assert.equal(doc.estado.operacoes[0].inspecoes.length, 1);
  });
});

describe("vagas candidatas à entrada (autorizar_entrada)", () => {
  const cenario = (car: Parameters<typeof op>[1] = {}) => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA", car);
    e.operacoes = [o];
    return { e, o };
  };
  const porCodigo = (e: EstadoTerminal, o: ReturnType<typeof op>) => Object.fromEntries(vagasParaEntrada(e, o).map((v) => [v.codigo, v]));

  it("carga comum: livres e fora de área interditada servem; motivo explica o resto", () => {
    const { e, o } = cenario();
    const outra = op("NO_PATIO");
    e.operacoes.push(outra);
    naVaga(e, outra, "V02");
    e.vagas.find((v) => v.codigo === "V03")!.estado = "EM_MANUTENCAO";
    const v = porCodigo(e, o);
    assert.deepEqual(Object.values(v).map((x) => x.codigo), ["V01", "V02", "V03", "V04", "V05", "V06", "V07"]);
    assert.deepEqual([v.V01.disponivel, v.V01.motivo], [true, null]);
    assert.deepEqual([v.V02.disponivel, v.V02.motivo], [false, "Ocupada"]);
    assert.deepEqual([v.V03.disponivel, v.V03.motivo], [false, "Em manutenção"]);
    assert.deepEqual([v.V07.disponivel, v.V07.motivo], [false, "Área interditada"]);
    assert.equal(v.V05.disponivel, true); // vaga refrigerada aceita carga comum
  });

  it("refrigerada e perigosa só nas áreas adequadas", () => {
    const refrigerada = cenario({ caracteristicas: ["refrigerada"] });
    const vr = porCodigo(refrigerada.e, refrigerada.o);
    assert.deepEqual(Object.values(vr).filter((x) => x.disponivel).map((x) => x.codigo), ["V05"]);
    assert.equal(vr.V01.motivo, "Área sem refrigeração");

    const perigosa = cenario({ caracteristicas: ["perigosa"] });
    const vp = porCodigo(perigosa.e, perigosa.o);
    assert.deepEqual(Object.values(vp).filter((x) => x.disponivel).map((x) => x.codigo), ["V06"]);
    assert.equal(vp.V01.motivo, "Área não autorizada para carga perigosa");
  });

  it("a lista e a ação concordam: vaga marcada como disponível é aceita; indisponível, recusada", () => {
    for (const car of [["comum"], ["refrigerada"], ["perigosa"], ["perigosa", "refrigerada"]] as const) {
      const { e, o } = cenario({ caracteristicas: [...car] });
      const outra = op("NO_PATIO");
      e.operacoes.push(outra);
      naVaga(e, outra, "V01");
      e.vagas.find((v) => v.codigo === "V04")!.estado = "EM_MANUTENCAO";
      for (const v of vagasParaEntrada(e, o)) {
        const tentativa = () => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: v.vaga_id });
        if (v.disponivel) assert.equal(tentativa().estado.operacoes[0].estado, "NO_PATIO", `${car.join("+")} ${v.codigo}`);
        else erro(tentativa, /Vaga indisponível ou inadequada/);
        assert.equal(vagaAdequada(e, e.vagas.find((x) => x.id === v.vaga_id)!, o), v.disponivel);
        assert.equal(motivoVagaIndisponivel(e, e.vagas.find((x) => x.id === v.vaga_id)!, o), v.motivo);
      }
    }
  });
});

describe("autorizar entrada: situações inválidas", () => {
  it("sem vagas disponíveis: nenhuma opção serve e a ação é recusada sem alterar nada", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    for (const v of e.vagas) if (v.codigo !== "V07") v.estado = "EM_MANUTENCAO";
    assert.equal(vagasParaEntrada(e, o).some((v) => v.disponivel), false);
    const antes = structuredClone(e);
    for (const v of e.vagas) erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: v.id }), /indisponível ou inadequada/);
    assert.deepEqual(e, antes);
  });

  it("vaga ocupada por outro caminhão não é tomada", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    const dono = op("NO_PATIO");
    e.operacoes = [o, dono];
    naVaga(e, dono, "V01");
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[0].id }), /indisponível ou inadequada/);
    assert.equal(e.vagas[0].operacao_id, dono.id);
  });

  it("vaga em manutenção e vaga inexistente são recusadas", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    e.vagas[0].estado = "EM_MANUTENCAO";
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[0].id }), /indisponível ou inadequada/);
    erro(() => rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: "inexistente" }), /Vaga não encontrada/);
  });

  it("duas entradas seguidas não ocupam a mesma vaga", () => {
    const e = terminalBase();
    const a = op("AGUARDANDO_ENTRADA");
    const b = op("AGUARDANDO_ENTRADA");
    e.operacoes = [a, b];
    const vaga = e.vagas[0].id;
    const r1 = rodar(e, { tipo: "yard-entry", operacaoId: a.id, vagaId: vaga });
    erro(() => rodar(r1.estado, { tipo: "yard-entry", operacaoId: b.id, vagaId: vaga }), /indisponível ou inadequada/);
    semViolacoes(r1.estado);
  });

  it("a mesma operação não entra duas vezes", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    const r1 = rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[0].id });
    erro(() => rodar(r1.estado, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[1].id }), /liberada para entrada/);
  });

  it("a entrada registra responsável (recepção), data e hora no histórico", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_ENTRADA");
    e.operacoes = [o];
    const r = rodar(e, { tipo: "yard-entry", operacaoId: o.id, vagaId: e.vagas[0].id });
    const n = r.estado.operacoes[0];
    assert.deepEqual(n.historico.map((h) => [h.tipo, h.responsavel_id, h.ocorrido_em]), [
      ["ALOCACAO_RECURSO", FUNC.recepcao.id, AGORA.toISOString()],
      ["MUDANCA_ESTADO", FUNC.recepcao.id, AGORA.toISOString()],
    ]);
    assert.equal(n.funcionario_responsavel_id, FUNC.recepcao.id);
    assert.equal(r.resultado.mensagem, `${n.caminhao.placa} autorizado a entrar na vaga V01.`);
  });
});

describe("fila: atualização a cada mudança (FilaAtendimento.ordenar)", () => {
  const ctxEm = (min: number) => ({ agora: new Date(AGORA.getTime() + min * 60_000), novoId: contextoFixo(7000 + min).novoId });

  it("chegada com documentação em dia entra na fila e é posicionada pela pontuação", () => {
    const e = terminalBase();
    e.operacoes = [op("NO_PATIO", { chegadaMin: 60 }), op("NO_PATIO", { chegadaMin: 10, caracteristicas: ["prioritária"] })]; // 30 e 105
    const r = executar(e, { tipo: "criar-operacao", dados: chegada({ documentacao_regular: true, caracteristicas: ["perigosa", "prioritária"] }) }, { agora: AGORA, novoId: contextoFixo().novoId });
    const fila = filaDe(r.estado, AGORA);
    assert.equal(fila.length, 3);
    assert.equal(fila[0].placa, "ABC-1D23"); // 150 pontos, 0 min de espera
    assert.equal(fila[0].pontuacao, 150);
    assert.deepEqual(fila.map((i) => i.posicao), [1, 2, 3]);
    assert.deepEqual(fila.slice(1).map((i) => i.pontuacao), [105, 30]);
  });

  it("chegada com documentação pendente ou inspeção NÃO entra na fila (fica na pré-entrada)", () => {
    const e = terminalBase();
    const a = rodar(e, { tipo: "criar-operacao", dados: chegada({ documentacao_regular: false }) });
    const b = rodar(a.estado, { tipo: "criar-operacao", dados: chegada({ placa: "DEF-2G34", documentacao_regular: true, exige_inspecao: true }) });
    assert.deepEqual(filaDe(b.estado, AGORA), []);
    assert.deepEqual(b.estado.operacoes.map((o) => o.estado), ["AGUARDANDO_DOCUMENTACAO", "AGUARDANDO_INSPECAO"]);
  });

  it("o caminhão entra na fila quando a documentação ou a inspeção é aprovada", () => {
    const e = terminalBase();
    const a = rodar(e, { tipo: "criar-operacao", dados: chegada({ documentacao_regular: false }) });
    const id = a.resultado.operacaoId!;
    assert.equal(filaDe(a.estado, AGORA).length, 0);
    const doc = rodar(a.estado, { tipo: "documentation", operacaoId: id, regular: true });
    assert.deepEqual(filaDe(doc.estado, AGORA).map((i) => i.placa), ["ABC-1D23"]);

    const b = rodar(e, { tipo: "criar-operacao", dados: chegada({ placa: "DEF-2G34", documentacao_regular: true, exige_inspecao: true }) });
    assert.equal(filaDe(b.estado, AGORA).length, 0);
    const insp = rodar(b.estado, { tipo: "inspection", operacaoId: b.resultado.operacaoId!, resultado: "ok", aprovado: true });
    assert.deepEqual(filaDe(insp.estado, AGORA).map((i) => i.placa), ["DEF-2G34"]);
  });

  it("autorizar a entrada mantém o caminhão na fila (NO_PATIO participa) e recalcula as posições", () => {
    const e = terminalBase();
    const antigo = op("AGUARDANDO_ENTRADA", { chegadaMin: 100 }); // 50
    const novo = op("AGUARDANDO_ENTRADA", { chegadaMin: 0, caracteristicas: ["prioritária"] }); // 100
    e.operacoes = [antigo, novo];
    assert.deepEqual(filaDe(e, AGORA).map((i) => i.operacao_id), [novo.id, antigo.id]);
    const r = rodar(e, { tipo: "yard-entry", operacaoId: novo.id, vagaId: e.vagas[0].id });
    const fila = filaDe(r.estado, AGORA);
    assert.deepEqual(fila.map((i) => [i.operacao_id, i.estado, i.posicao]), [
      [novo.id, "NO_PATIO", 1],
      [antigo.id, "AGUARDANDO_ENTRADA", 2],
    ]);
  });

  it("a pontuação de todos cresce 0,5 por minuto; a diferença só muda com novas chegadas", () => {
    const e = terminalBase();
    const comum = op("AGUARDANDO_ENTRADA", { chegadaMin: 190 }); // 95 agora
    const prioritario = op("AGUARDANDO_ENTRADA", { chegadaMin: 0, caracteristicas: ["prioritária"] }); // 100
    e.operacoes = [comum, prioritario];
    const agora = filaDe(e, AGORA);
    assert.deepEqual(agora.map((i) => [i.operacao_id, i.pontuacao]), [[prioritario.id, 100], [comum.id, 95]]);
    const depois = filaDe(e, ctxEm(20).agora); // +20 min: comum 105, prioritário 110
    assert.deepEqual(depois.map((i) => i.operacao_id), [prioritario.id, comum.id]);
    const muito = filaDe(e, ctxEm(120).agora); // +120 min: comum 155, prioritário 160
    assert.deepEqual(muito.map((i) => [i.operacao_id, i.pontuacao]), [[prioritario.id, 160], [comum.id, 155]]);
  });

  it("inspeção reprovada tira o caminhão da fila (volta à documentação)", () => {
    const e = terminalBase();
    const o = op("AGUARDANDO_INSPECAO");
    e.operacoes = [o];
    const aprovada = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "ok", aprovado: true });
    assert.equal(filaDe(aprovada.estado, AGORA).length, 1);
    const reprovada = rodar(e, { tipo: "inspection", operacaoId: o.id, resultado: "falha", aprovado: false });
    assert.equal(filaDe(reprovada.estado, AGORA).length, 0);
  });

  it("os fatores exibidos somam a pontuação (nada fixo)", () => {
    const e = terminalBase();
    e.operacoes = [op("AGUARDANDO_ENTRADA", { chegadaMin: 30, caracteristicas: ["refrigerada", "frágil"] })];
    const [item] = filaDe(e, AGORA);
    const soma = item.fatores.reduce((s, f) => s + (f.tipo === "caracteristica" ? f.peso : f.pontos), 0);
    assert.equal(item.pontuacao, 30 + 20 + 15);
    assert.equal(soma, item.pontuacao);
  });
});

describe("fluxos completos de ponta a ponta", () => {
  const ctx = () => contextoFixo(8000);

  it("A. documentação pendente → regular → entrada → pátio → fila", () => {
    let e = terminalBase();
    const c = ctx();
    let r = executar(e, { tipo: "criar-operacao", dados: chegada() }, { agora: AGORA, novoId: c.novoId });
    e = r.estado;
    const id = r.resultado.operacaoId!;
    assert.equal(e.operacoes[0].estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(resumoDoPainel(e).por_estado.AGUARDANDO_DOCUMENTACAO, 1);
    e = executar(e, { tipo: "documentation", operacaoId: id, regular: true }, { agora: AGORA, novoId: c.novoId }).estado;
    assert.equal(e.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    const vaga = vagasParaEntrada(e, e.operacoes[0]).find((v) => v.disponivel)!;
    r = executar(e, { tipo: "yard-entry", operacaoId: id, vagaId: vaga.vaga_id }, { agora: AGORA, novoId: c.novoId });
    e = r.estado;
    assert.equal(e.operacoes[0].estado, "NO_PATIO");
    assert.equal(e.vagas.find((v) => v.id === vaga.vaga_id)!.operacao_id, id);
    assert.deepEqual(filaDe(e, AGORA).map((i) => i.operacao_id), [id]);
    semViolacoes(e);
  });

  it("B. documentação em dia com inspeção aprovada → entrada", () => {
    let e = terminalBase();
    const c = ctx();
    const r = executar(e, { tipo: "criar-operacao", dados: chegada({ documentacao_regular: true, exige_inspecao: true, caracteristicas: ["refrigerada"] }) }, { agora: AGORA, novoId: c.novoId });
    e = r.estado;
    const id = r.resultado.operacaoId!;
    e = executar(e, { tipo: "inspection", operacaoId: id, resultado: "Baú limpo e lacrado", aprovado: true }, { agora: AGORA, novoId: c.novoId }).estado;
    assert.equal(e.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    const [so] = vagasParaEntrada(e, e.operacoes[0]).filter((v) => v.disponivel);
    assert.equal(so.codigo, "V05"); // única vaga refrigerada
    e = executar(e, { tipo: "yard-entry", operacaoId: id, vagaId: so.vaga_id }, { agora: AGORA, novoId: c.novoId }).estado;
    assert.equal(e.operacoes[0].estado, "NO_PATIO");
    assert.equal(e.operacoes[0].inspecoes.length, 1);
    assert.deepEqual(e.operacoes[0].historico.map((h) => h.tipo), ["CHEGADA", "INSPECAO", "MUDANCA_ESTADO", "ALOCACAO_RECURSO", "MUDANCA_ESTADO"]);
    semViolacoes(e);
  });

  it("C. inspeção reprovada → documentação → entrada", () => {
    let e = terminalBase();
    const c = ctx();
    const r = executar(e, { tipo: "criar-operacao", dados: chegada({ documentacao_regular: true, exige_inspecao: true }) }, { agora: AGORA, novoId: c.novoId });
    e = r.estado;
    const id = r.resultado.operacaoId!;
    for (const a of [
      { tipo: "inspection", operacaoId: id, resultado: "Lacre rompido", aprovado: false },
      { tipo: "documentation", operacaoId: id, regular: true },
    ] as Acao[]) e = executar(e, a, { agora: AGORA, novoId: c.novoId }).estado;
    assert.equal(e.operacoes[0].estado, "AGUARDANDO_ENTRADA");
    semViolacoes(e);
  });

  it("D. a vaga ocupada pela entrada deixa de ser candidata para o próximo caminhão", () => {
    let e = terminalBase();
    const c = ctx();
    for (const placa of ["AAA-1A11", "BBB-2B22"]) {
      const r = executar(e, { tipo: "criar-operacao", dados: chegada({ placa, documentacao_regular: true }) }, { agora: AGORA, novoId: c.novoId });
      e = r.estado;
    }
    const [primeiro, segundo] = e.operacoes;
    const v1 = vagasParaEntrada(e, primeiro).find((v) => v.disponivel)!;
    e = executar(e, { tipo: "yard-entry", operacaoId: primeiro.id, vagaId: v1.vaga_id }, { agora: AGORA, novoId: c.novoId }).estado;
    const candidatas = vagasParaEntrada(e, segundo);
    assert.equal(candidatas.find((v) => v.vaga_id === v1.vaga_id)!.motivo, "Ocupada");
    assert.notEqual(candidatas.find((v) => v.disponivel)!.vaga_id, v1.vaga_id);
  });
});

describe("seletor da interface (montarTerminal)", () => {
  it("entrada: vagas candidatas só para quem aguarda entrada; funcionários expostos", () => {
    const e = criarCenarioInicial(AGORA);
    const t = montarTerminal(e, AGORA);
    const aguardando = e.operacoes.filter((o) => o.estado === "AGUARDANDO_ENTRADA").map((o) => o.id).sort();
    assert.deepEqual(t.entrada.map((x) => x.operacao_id).sort(), aguardando);
    assert.equal(t.funcionarios.length, 4);
    assert.ok(t.funcionarios.every((f) => f.id && f.nome && f.funcao));
  });

  it("uma chegada nova aparece no painel, na pré-entrada e (se liberada) na fila do seletor", () => {
    const e0 = criarCenarioInicial(AGORA);
    const antes = montarTerminal(e0, AGORA);
    const r = executar(e0, { tipo: "criar-operacao", dados: chegada({ placa: "ZZZ-9Z99", documentacao_regular: true, caracteristicas: ["prioritária"] }) }, { agora: AGORA, novoId: contextoFixo(9500).novoId });
    const depois = montarTerminal(r.estado, AGORA);
    assert.equal(depois.dashboard.total_operacoes, antes.dashboard.total_operacoes + 1);
    assert.equal(depois.dashboard.por_estado.AGUARDANDO_ENTRADA, antes.dashboard.por_estado.AGUARDANDO_ENTRADA + 1);
    const item = depois.fila.find((i) => i.placa === "ZZZ-9Z99")!;
    assert.equal(item.pontuacao, 100);
    assert.equal(item.posicao, depois.fila.filter((i) => i.pontuacao > 100).length + 1);
    assert.equal(depois.fila.length, antes.fila.length + 1);
    assert.ok(depois.entrada.some((x) => x.operacao_id === item.operacao_id));
    semViolacoes(r.estado);
  });

  it("o seed inicial continua sem violações depois do ciclo completo de um caminhão novo", () => {
    let e = criarCenarioInicial(AGORA);
    const c = contextoFixo(9800);
    const passo = (a: Acao) => (e = executar(e, a, { agora: AGORA, novoId: c.novoId }).estado);
    passo({ tipo: "criar-operacao", dados: chegada({ placa: "NEW-1A11" }) });
    const id = e.operacoes.at(-1)!.id;
    passo({ tipo: "documentation", operacaoId: id, regular: true });
    const vaga = vagasParaEntrada(e, e.operacoes.at(-1)!).find((v) => v.disponivel)!;
    passo({ tipo: "yard-entry", operacaoId: id, vagaId: vaga.vaga_id });
    assert.equal(e.operacoes.at(-1)!.estado, "NO_PATIO");
    semViolacoes(e);
  });
});
