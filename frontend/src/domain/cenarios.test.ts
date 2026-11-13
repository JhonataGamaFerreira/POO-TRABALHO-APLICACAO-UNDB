/**
 * Os dois cenários de demonstração (MVP reduzido e completo) precisam respeitar as
 * regras do back-end, ter o tamanho anunciado no menu, ser independentes entre si
 * e permitir os fluxos operacionais. Falha aqui = seed fora das regras.
 * (As contagens e a fila do cenário completo original continuam em `cenario.test.ts`.)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CENARIOS, CENARIO_PADRAO, ORDEM_CENARIOS, criarCenario } from "@/mocks/cenarios";
import { criarCenarioInicial } from "@/mocks/cenario";
import { executar } from "./acoes";
import { filaDe, interrupcaoDaDoca, motivoEspera, resumoDoPainel, vagasParaEntrada } from "./derivados";
import { AGORA, contextoFixo } from "./fabrica-teste";
import { verificarInvariantes } from "./invariantes";
import { vagaAdequada } from "./regras";
import type { Acao, EstadoTerminal } from "./tipos";

const ativos = (e: EstadoTerminal) => e.operacoes.filter((o) => o.estado !== "FINALIZADO");
const op = (e: EstadoTerminal, placa: string) => e.operacoes.find((o) => o.caminhao.placa === placa)!;
const vaga = (e: EstadoTerminal, codigo: string) => e.vagas.find((v) => v.codigo === codigo)!;
const doca = (e: EstadoTerminal, codigo: string) => e.docas.find((d) => d.codigo === codigo)!;
const equip = (e: EstadoTerminal, nome: string) => e.equipamentos.find((q) => q.nome === nome)!;
const ctx = contextoFixo();
const rodar = (e: EstadoTerminal, a: Acao) => executar(e, a, ctx);

describe("registro de cenários", () => {
  it("o cenário reduzido é o padrão e os dois estão disponíveis, nesta ordem", () => {
    assert.equal(CENARIO_PADRAO, "mvp");
    assert.deepEqual(ORDEM_CENARIOS, ["mvp", "completo"]);
    assert.equal(CENARIOS.mvp.nome, "Cenário de demonstração MVP");
    assert.equal(CENARIOS.completo.nome, "Cenário completo");
  });

  it("o resumo anunciado no menu confere com os dados de cada cenário", () => {
    for (const id of ORDEM_CENARIOS) {
      const e = criarCenario(id, AGORA);
      assert.equal(
        CENARIOS[id].resumo,
        `${ativos(e).length} caminhões ativos · ${e.vagas.length} vagas · ${e.docas.length} docas · ${e.equipamentos.length} equipamentos`,
      );
    }
  });

  it("os cenários são independentes: alterar o estado de um nunca muda a definição de nenhum", () => {
    for (const id of ORDEM_CENARIOS) {
      const antes = JSON.stringify(criarCenario(id, AGORA));
      // Cada chamada devolve objetos novos: mexer em um estado não vaza para o próximo.
      const mexido = criarCenario(id, AGORA);
      mexido.vagas[0].estado = "EM_MANUTENCAO";
      mexido.funcionarios[0].nome = "Alterado";
      mexido.operacoes[0].caminhao.placa = "XXX-0X00";
      mexido.politica.bonus_por_minuto = 99;
      assert.equal(JSON.stringify(criarCenario(id, AGORA)), antes);
      // Criar o outro cenário no meio também não interfere.
      const outro = ORDEM_CENARIOS.find((x) => x !== id)!;
      criarCenario(outro, AGORA);
      assert.equal(JSON.stringify(criarCenario(id, AGORA)), antes);
    }
  });

  it("os dois têm tamanhos diferentes (nunca misturados em um mesmo estado)", () => {
    const m = criarCenario("mvp", AGORA);
    const c = criarCenario("completo", AGORA);
    assert.ok(m.vagas.length < c.vagas.length && m.docas.length < c.docas.length);
    assert.ok(m.equipamentos.length < c.equipamentos.length && m.operacoes.length < c.operacoes.length);
  });
});

describe("cenário completo (original preservado)", () => {
  const e = criarCenario("completo", AGORA);

  it("é exatamente o cenário inicial anterior", () => {
    assert.deepEqual(e, criarCenarioInicial(AGORA));
  });

  it("mantém 18 vagas, 8 docas, 6 equipamentos e 17 caminhões ativos (40 operações)", () => {
    assert.equal(e.vagas.length, 18);
    assert.equal(e.docas.length, 8);
    assert.equal(e.equipamentos.length, 6);
    assert.equal(ativos(e).length, 17);
    assert.equal(e.operacoes.length, 40);
    assert.equal(e.ocorrencias.length, 4);
    assert.deepEqual(verificarInvariantes(e), []);
  });
});

describe("cenário de demonstração MVP (reduzido)", () => {
  const e = criarCenario("mvp", AGORA);

  it("não tem violações das regras do back-end", () => {
    assert.deepEqual(verificarInvariantes(e), []);
  });

  it("tem 8 vagas, 3 docas, 3 equipamentos e 6 caminhões ativos", () => {
    assert.equal(e.vagas.length, 8);
    assert.equal(e.docas.length, 3);
    assert.equal(e.equipamentos.length, 3);
    assert.equal(ativos(e).length, 6);
    assert.equal(e.operacoes.length, 9); // + 3 finalizados (só o contador "finalizados hoje")
  });

  it("distribui os caminhões ativos em seis etapas diferentes", () => {
    const r = resumoDoPainel(e);
    assert.equal(r.por_estado.AGUARDANDO_DOCUMENTACAO, 1);
    assert.equal(r.por_estado.AGUARDANDO_INSPECAO, 1);
    assert.equal(r.por_estado.AGUARDANDO_ENTRADA, 0);
    assert.equal(r.por_estado.NO_PATIO, 1);
    assert.equal(r.por_estado.AGUARDANDO_RECURSO, 1);
    assert.equal(r.por_estado.EM_OPERACAO, 1);
    assert.equal(r.por_estado.AGUARDANDO_LIBERACAO, 1);
    assert.equal(r.por_estado.FINALIZADO, 3);
    assert.equal(op(e, "ABC-1D23").estado, "AGUARDANDO_DOCUMENTACAO");
    assert.equal(op(e, "DEF-2E34").estado, "AGUARDANDO_INSPECAO");
    assert.equal(op(e, "RIO-9D01").estado, "NO_PATIO");
    assert.equal(op(e, "FGH-2J34").estado, "AGUARDANDO_RECURSO");
    assert.equal(op(e, "PQR-1A11").estado, "EM_OPERACAO");
    assert.equal(op(e, "JKL-7G45").estado, "AGUARDANDO_LIBERACAO");
  });

  it("legenda — estado do recurso: livre, ocupado e em manutenção", () => {
    const r = resumoDoPainel(e).recursos;
    assert.deepEqual([r.vagas.LIVRE, r.vagas.OCUPADO, r.vagas.EM_MANUTENCAO], [5, 3, 0]);
    assert.deepEqual([r.docas.LIVRE, r.docas.OCUPADO, r.docas.EM_MANUTENCAO], [2, 1, 0]);
    assert.deepEqual([r.equipamentos.DISPONIVEL, r.equipamentos.OCUPADO, r.equipamentos.EM_MANUTENCAO], [0, 1, 2]);
    assert.equal(equip(e, "EQ-03").estado, "EM_MANUTENCAO");
  });

  it("legenda — condições: interrupção, área interditada e equipamento quebrado", () => {
    // Interrupção: a D3 está livre e é a doca de origem da operação interrompida.
    const interrupcao = interrupcaoDaDoca(e, doca(e, "D3"));
    assert.equal(interrupcao?.operacao_id, op(e, "FGH-2J34").id);
    // Área interditada: a V08 está na Área Norte e não serve a nenhuma carga.
    const norte = e.areas.find((a) => a.id === vaga(e, "V08").area_id)!;
    assert.equal(norte.interditada, true);
    assert.ok(e.operacoes.every((o) => !vagaAdequada(e, vaga(e, "V08"), o)));
    // Equipamento quebrado: em manutenção com ocorrência aberta; a EQ-03 está só em manutenção.
    const quebrada = e.ocorrencias.find((o) => o.tipo === "EQUIPAMENTO_QUEBRADO" && o.estado === "ABERTA")!;
    assert.equal(quebrada.recurso_id, equip(e, "EQ-02").id);
    assert.equal(equip(e, "EQ-02").estado, "EM_MANUTENCAO");
    assert.ok(!e.ocorrencias.some((o) => o.recurso_id === equip(e, "EQ-03").id));
  });

  it("legenda — severidade: pelo menos uma crítica e uma de atenção, abertas", () => {
    const abertas = e.ocorrencias.filter((o) => o.estado === "ABERTA");
    assert.equal(abertas.length, 2);
    assert.ok(abertas.some((o) => o.severidade === "critica"));
    assert.ok(abertas.some((o) => o.severidade === "media" || o.severidade === "alta"));
  });

  it("não tem estados contraditórios nos recursos", () => {
    // Recurso em manutenção ou ocupado só aponta para operação quando ocupado.
    for (const r of [...e.vagas, ...e.docas, ...e.equipamentos]) {
      assert.equal(r.operacao_id !== null, r.estado === "OCUPADO");
    }
    // Nada está ocupado dentro de área interditada.
    const interditadas = new Set(e.areas.filter((a) => a.interditada).map((a) => a.id));
    for (const r of [...e.vagas, ...e.docas]) {
      if (interditadas.has(r.area_id)) assert.notEqual(r.estado, "OCUPADO");
    }
    // Quem está em operação ocupa vaga, doca e equipamento; os demais, só a vaga ou nada.
    const pqr = op(e, "PQR-1A11");
    assert.ok(pqr.vaga_id && pqr.doca_id && pqr.equipamento_id);
    assert.ok(!op(e, "JKL-7G45").vaga_id && !op(e, "JKL-7G45").doca_id && !op(e, "JKL-7G45").equipamento_id);
    assert.ok(op(e, "FGH-2J34").vaga_id && !op(e, "FGH-2J34").doca_id && !op(e, "FGH-2J34").equipamento_id);
  });

  it("fila: a prioritária vem primeiro e os motivos de espera são coerentes", () => {
    const fila = filaDe(e, AGORA);
    assert.deepEqual(fila.map((i) => i.placa), ["FGH-2J34", "RIO-9D01"]);
    assert.ok(fila[0].pontuacao > fila[1].pontuacao);
    assert.ok(op(e, "FGH-2J34").carga.caracteristicas.includes("prioritária"));
    assert.equal(motivoEspera(e, op(e, "FGH-2J34")), "Operação interrompida na D3");
    assert.equal(motivoEspera(e, op(e, "RIO-9D01")), "Aguarda EQ-02 e EQ-03 (em manutenção)");
  });

  it("fluxo: sem equipamento disponível, iniciar o do pátio o deixa aguardando recurso", () => {
    const { estado, resultado } = rodar(e, { tipo: "start", operacaoId: op(e, "RIO-9D01").id });
    assert.equal(resultado.iniciada, false);
    assert.equal(op(estado, "RIO-9D01").estado, "AGUARDANDO_RECURSO");
    assert.deepEqual(verificarInvariantes(estado), []);
  });

  it("fluxo: finalizar libera D1 e EQ-01; a prioritária retoma na D3 e o resto segue o ciclo", () => {
    let s = rodar(e, { tipo: "finish", operacaoId: op(e, "PQR-1A11").id }).estado;
    assert.equal(op(s, "PQR-1A11").estado, "AGUARDANDO_LIBERACAO");
    assert.equal(doca(s, "D1").estado, "LIVRE");
    assert.equal(equip(s, "EQ-01").estado, "DISPONIVEL");

    const retomada = rodar(s, { tipo: "start", operacaoId: op(s, "FGH-2J34").id });
    s = retomada.estado;
    assert.equal(retomada.resultado.iniciada, true);
    const fgh = op(s, "FGH-2J34");
    assert.equal(fgh.estado, "EM_OPERACAO");
    assert.equal(fgh.doca_id, doca(s, "D3").id); // única doca que aceita carga perigosa
    assert.equal(fgh.equipamento_id, equip(s, "EQ-01").id);
    assert.equal(fgh.interrupcao, null);

    s = rodar(s, { tipo: "release", operacaoId: op(s, "JKL-7G45").id }).estado;
    s = rodar(s, { tipo: "release", operacaoId: op(s, "PQR-1A11").id }).estado;
    assert.equal(resumoDoPainel(s).por_estado.FINALIZADO, 5);
    assert.deepEqual(verificarInvariantes(s), []);
  });

  it("fluxo: documentação, inspeção e entrada no pátio dos caminhões da triagem", () => {
    let s = rodar(e, { tipo: "documentation", operacaoId: op(e, "ABC-1D23").id, regular: true }).estado;
    assert.equal(op(s, "ABC-1D23").estado, "AGUARDANDO_ENTRADA");
    s = rodar(s, { tipo: "inspection", operacaoId: op(s, "DEF-2E34").id, resultado: "Sem avarias", aprovado: true }).estado;
    assert.equal(op(s, "DEF-2E34").estado, "AGUARDANDO_ENTRADA");
    s = rodar(s, { tipo: "yard-entry", operacaoId: op(s, "ABC-1D23").id, vagaId: vaga(s, "V02").id }).estado;
    assert.equal(op(s, "ABC-1D23").estado, "NO_PATIO");
    assert.equal(vaga(s, "V02").operacao_id, op(s, "ABC-1D23").id);
    assert.deepEqual(verificarInvariantes(s), []);
  });

  it("fluxo: resolver a quebra e tirar a EQ-02 de manutenção permite iniciar o caminhão do pátio", () => {
    let s = rodar(e, { tipo: "resolve-occurrence", ocorrenciaId: e.ocorrencias[0].id }).estado;
    s = rodar(s, { tipo: "maintenance", recurso: { tipo: "equipment", id: equip(s, "EQ-02").id }, emManutencao: false }).estado;
    const r = rodar(s, { tipo: "start", operacaoId: op(s, "RIO-9D01").id });
    assert.equal(r.resultado.iniciada, true);
    const rio = op(r.estado, "RIO-9D01");
    assert.equal(rio.doca_id, doca(r.estado, "D2").id); // a D1 segue ocupada
    assert.equal(rio.equipamento_id, equip(r.estado, "EQ-02").id);
    assert.deepEqual(verificarInvariantes(r.estado), []);
  });

  it("fluxo: uma chegada nova passa pela entrada e entra na fila sem vaga interditada ou ocupada", () => {
    const { estado: s0, resultado } = rodar(e, {
      tipo: "criar-operacao",
      dados: {
        nome_motorista: "Nair Gomes", documento_motorista: "DOC-9001", placa: "SLZ-4D21",
        transportadora: "LogMar", descricao_carga: "Carga geral", caracteristicas: ["comum"],
        tipo: "descarga", documentacao_regular: true, exige_inspecao: false,
      },
    });
    assert.equal(op(s0, "SLZ-4D21").estado, "AGUARDANDO_ENTRADA");
    const novo = s0.operacoes.find((o) => o.id === resultado.operacaoId)!;
    const livres = vagasParaEntrada(s0, novo).filter((v) => v.disponivel).map((v) => v.codigo);
    assert.deepEqual(livres, ["V02", "V03", "V06", "V07"]);
    const s1 = rodar(s0, { tipo: "yard-entry", operacaoId: novo.id, vagaId: vaga(s0, "V02").id }).estado;
    assert.deepEqual(filaDe(s1, AGORA).map((i) => i.placa), ["FGH-2J34", "RIO-9D01", "SLZ-4D21"]);
    assert.deepEqual(verificarInvariantes(s1), []);
  });

  it("fluxo: liberar a Área Norte devolve a V08 às alocações", () => {
    const area = vaga(e, "V08").area_id;
    const s = rodar(e, { tipo: "area-interdicao", areaId: area, interditada: false }).estado;
    assert.ok(vagaAdequada(s, vaga(s, "V08"), op(s, "RIO-9D01")));
  });
});
