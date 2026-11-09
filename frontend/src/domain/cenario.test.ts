/**
 * O cenário inicial precisa respeitar as regras do back-end e reproduzir os
 * números aprovados nos wireframes. Falha aqui = seed fora das regras.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { criarCenarioInicial } from "@/mocks/cenario";
import { filaDe, motivoEspera, resumoDoPainel, restricaoDoca } from "./derivados";
import { verificarInvariantes } from "./invariantes";

const AGORA = new Date("2026-11-13T15:00:00.000Z");

describe("cenário inicial", () => {
  const e = criarCenarioInicial(AGORA);

  it("não tem violações das regras do back-end", () => {
    assert.deepEqual(verificarInvariantes(e), []);
  });

  it("reproduz as contagens dos wireframes", () => {
    const r = resumoDoPainel(e);
    assert.equal(r.total_operacoes, 40);
    assert.equal(r.por_estado.FINALIZADO, 23);
    assert.equal(r.por_estado.AGUARDANDO_RECURSO, 5);
    assert.equal(r.por_estado.EM_OPERACAO, 5);
    assert.equal(r.recursos.docas.OCUPADO, 5);
    assert.equal(r.recursos.docas.EM_MANUTENCAO, 1);
    assert.equal(r.recursos.equipamentos.EM_MANUTENCAO, 1);
    assert.equal(r.recursos.equipamentos.OCUPADO, 5);
  });

  it("fila inicial: ordem e pontuações do cenário aprovado", () => {
    const fila = filaDe(e, AGORA);
    assert.deepEqual(fila.map((i) => i.placa), [
      "FGH-2J34", "KLM-8P12", "VWX-3C33", "BRA-5C67", "NOP-6F90", "RIO-9D01", "TPN-3E58", "UVW-1H22", "XYZ-2J33",
    ]);
    assert.deepEqual(fila.map((i) => i.pontuacao), [206, 70, 55, 24, 20.5, 17.5, 6, 4.5, 2]);
  });

  it("textos explicativos derivados do estado", () => {
    const motivo = (placa: string) => motivoEspera(e, e.operacoes.find((o) => o.caminhao.placa === placa)!);
    assert.equal(motivo("FGH-2J34"), "Aguarda EQ-02 (quebrado)");
    assert.equal(motivo("KLM-8P12"), "Sem doca refrigerada livre; D4 em manutenção");
    assert.equal(motivo("VWX-3C33"), "Operação interrompida na D3");
    assert.equal(motivo("RIO-9D01"), "Aguarda EQ-02 (quebrado)");
    const d7 = e.docas.find((d) => d.codigo === "D7")!;
    assert.match(restricaoDoca(e, d7)!.texto, /^EQ-02 está quebrado\. EQ-01, EQ-03, EQ-04, EQ-05 e EQ-06 estão em uso nas docas D1, D2, D5, D6 e D8\.$/);
  });
});
