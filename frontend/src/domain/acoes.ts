/**
 * Ações do terminal, espelhando `Operacao`, `AlocadorDeRecursos`,
 * `ServicoDominioTerminal` e os endpoints de `api.py` (backend, b16a874).
 *
 * `executar` não altera o estado recebido: clona, aplica a ação e devolve o
 * novo estado. Se uma regra for violada, lança `ErroDeDominio` (o backend
 * responderia 409/403/422) e o estado original permanece intacto.
 *
 * O que NÃO é do backend e fica marcado como PROPOSTA/HIPÓTESE:
 *  - `responsavelPara`: quem executa cada ação (o front não tem login). O
 *    backend só EXIGE função em: iniciar (operador habilitado), resolver
 *    ocorrência, manutenção e interdição (supervisão). As demais usam o papel
 *    natural da ação. Na chegada o backend não recebe responsável nem grava
 *    evento; o front guarda a recepção em `funcionario_responsavel_id`.
 *  - títulos curtos, métrica e vínculo de interrupção da doca.
 */
import type { EstadoCaminhao, TipoOcorrencia, TipoEvento } from "@/types/terminal";
import {
  areaAdequada,
  areaDe,
  docaAdequada,
  ehSupervisao,
  equipamentoCompativel,
  estadoInicial,
  exige,
  habilitacaoPara,
  habilitado,
  minutosEntre,
  transicaoPermitida,
  vagaAdequada,
} from "./regras";
import { normalizarPlaca, primeiroErro, validarNovaOperacao } from "./validacao";
import {
  type Acao,
  type Contexto,
  ErroDeDominio,
  type EstadoTerminal,
  type Funcionario,
  type FuncaoFuncionario,
  type OcorrenciaE,
  type OperacaoE,
  type ResultadoAcao,
} from "./tipos";

/* ---------- Acesso por id ---------- */

const obterOperacao = (e: EstadoTerminal, id: string): OperacaoE => {
  const op = e.operacoes.find((o) => o.id === id);
  if (!op) throw new ErroDeDominio("Operação não encontrada.");
  return op;
};

const obterVaga = (e: EstadoTerminal, id: string) => {
  const v = e.vagas.find((x) => x.id === id);
  if (!v) throw new ErroDeDominio("Vaga não encontrada.");
  return v;
};

const rotuloEstado = (s: EstadoCaminhao) => s;

/* ---------- Responsável (HIPÓTESE: sem login) ---------- */

/** Papel natural de cada ação. Só os marcados com * são exigidos pelo backend. */
const PAPEL: Record<Acao["tipo"], FuncaoFuncionario> = {
  "criar-operacao": "RECEPCAO",
  documentation: "RECEPCAO",
  inspection: "INSPETOR",
  "yard-entry": "RECEPCAO",
  start: "OPERADOR", // *
  interrupt: "OPERADOR",
  cancel: "SUPERVISOR",
  finish: "OPERADOR",
  release: "RECEPCAO",
  "resolve-occurrence": "SUPERVISOR", // *
  maintenance: "SUPERVISOR", // *
  "area-interdicao": "SUPERVISOR", // *
};

/** Funcionário que executa uma ação do tipo dado (`op` só importa em `start`: habilitação). */
export function responsavelDaAcao(
  e: EstadoTerminal,
  tipo: Acao["tipo"],
  op?: OperacaoE,
): Funcionario {
  const papel = PAPEL[tipo];
  const candidatos = e.funcionarios.filter((f) =>
    papel === "SUPERVISOR" ? ehSupervisao(f) : f.funcao === papel,
  );
  const escolhido = tipo === "start" && op ? candidatos.find((f) => habilitado(f, op.tipo)) : candidatos[0];
  if (!escolhido) {
    throw new ErroDeDominio(
      tipo === "start" && op
        ? `Funcionário não está habilitado para ${habilitacaoPara(op.tipo)}.`
        : "Nenhum funcionário disponível para esta ação.",
    );
  }
  return escolhido;
}

export const responsavelPara = (e: EstadoTerminal, acao: Acao, op?: OperacaoE): Funcionario =>
  responsavelDaAcao(e, acao.tipo, op);

/* ---------- Histórico, estado e ocorrência (Operacao) ---------- */

function registrarEvento(
  ctx: Contexto,
  op: OperacaoE,
  tipo: TipoEvento,
  responsavel: Funcionario,
  descricao: string,
  anterior: EstadoCaminhao | null = null,
  novo: EstadoCaminhao | null = null,
) {
  op.historico.push({
    id: ctx.novoId(),
    tipo,
    ocorrido_em: ctx.agora.toISOString(),
    responsavel_id: responsavel.id,
    descricao,
    estado_anterior: anterior,
    estado_novo: novo,
  });
}

/** `Operacao._mudar_estado`. */
function mudarEstado(ctx: Contexto, op: OperacaoE, destino: EstadoCaminhao, resp: Funcionario) {
  if (!transicaoPermitida(op.estado, destino)) {
    throw new ErroDeDominio(`Transição inválida: ${op.estado} → ${destino}.`);
  }
  const anterior = op.estado;
  op.estado = destino;
  op.funcionario_responsavel_id = resp.id;
  registrarEvento(
    ctx, op, "MUDANCA_ESTADO", resp,
    `Estado alterado para ${rotuloEstado(destino)}.`, anterior, destino,
  );
}

interface ExtraOcorrencia {
  severidade?: OcorrenciaE["severidade"];
  impacto?: OcorrenciaE["impacto"];
  recurso_tipo?: OcorrenciaE["recurso_tipo"];
  recurso_id?: string | null;
  titulo?: string;
  metrica_rotulo?: OcorrenciaE["metrica_rotulo"];
}

/** `Operacao.registrar_ocorrencia`. Severidade e impacto padrão: media / operacao. */
function registrarOcorrencia(
  e: EstadoTerminal,
  ctx: Contexto,
  op: OperacaoE,
  tipo: TipoOcorrencia,
  descricao: string,
  resp: Funcionario,
  extra: ExtraOcorrencia = {},
): OcorrenciaE {
  const oc: OcorrenciaE = {
    id: ctx.novoId(),
    tipo,
    descricao,
    responsavel_id: resp.id,
    criada_em: ctx.agora.toISOString(),
    estado: "ABERTA",
    resolvida_em: null,
    resolvida_por: null,
    severidade: extra.severidade ?? "media",
    impacto: extra.impacto ?? "operacao",
    recurso_tipo: extra.recurso_tipo ?? null,
    recurso_id: extra.recurso_id ?? null,
    operacao_id: op.id,
    titulo: extra.titulo ?? null,
    operacoes_afetadas: null,
    metrica_rotulo: extra.metrica_rotulo ?? null,
  };
  e.ocorrencias.push(oc);
  op.funcionario_responsavel_id = resp.id;
  registrarEvento(ctx, op, "OCORRENCIA", resp, descricao);
  return oc;
}

/** `Operacao.liberar_recursos(manter_vaga)`. */
function liberarRecursos(e: EstadoTerminal, op: OperacaoE, manterVaga = false) {
  if (op.vaga_id && !manterVaga) {
    const v = e.vagas.find((x) => x.id === op.vaga_id);
    if (v) {
      v.estado = "LIVRE";
      v.operacao_id = null;
    }
    op.vaga_id = null;
  }
  if (op.doca_id) {
    const d = e.docas.find((x) => x.id === op.doca_id);
    if (d) {
      d.estado = "LIVRE";
      d.operacao_id = null;
    }
    op.doca_id = null;
  }
  if (op.equipamento_id) {
    const q = e.equipamentos.find((x) => x.id === op.equipamento_id);
    if (q) {
      if (q.estado === "OCUPADO") q.estado = "DISPONIVEL";
      q.operacao_id = null;
    }
    op.equipamento_id = null;
  }
}

const placaDe = (op: OperacaoE) => op.caminhao.placa;

/* ---------- Ações ---------- */

/** `POST /api/operations` + `FabricaOperacao.criar`. */
function criarOperacao(
  e: EstadoTerminal,
  ctx: Contexto,
  dados: Extract<Acao, { tipo: "criar-operacao" }>["dados"],
  resp: Funcionario,
): ResultadoAcao {
  const erro = primeiroErro(validarNovaOperacao(dados));
  if (erro) throw new ErroDeDominio(erro);

  const nome = dados.nome_motorista.trim();
  const documento = dados.documento_motorista.trim();
  const placa = normalizarPlaca(dados.placa);
  const transportadora = dados.transportadora.trim();
  const carga = dados.descricao_carga.trim();

  // Caminhão já cadastrado pela placa é reaproveitado (api.py: criar_operacao).
  const existente = e.operacoes.find((o) => o.caminhao.placa === placa)?.caminhao;
  const caminhao = existente
    ? structuredClone(existente)
    : {
        id: ctx.novoId(),
        placa,
        motorista: { id: ctx.novoId(), nome, documento },
        transportadora: { id: ctx.novoId(), nome: transportadora },
      };

  const op: OperacaoE = {
    id: ctx.novoId(),
    caminhao,
    carga: { descricao: carga, caracteristicas: [...new Set(dados.caracteristicas)] },
    tipo: dados.tipo,
    chegada_em: ctx.agora.toISOString(),
    estado: estadoInicial(dados.documentacao_regular, dados.exige_inspecao),
    documentacao_regular: dados.documentacao_regular,
    vaga_id: null,
    doca_id: null,
    equipamento_id: null,
    funcionario_responsavel_id: resp.id,
    iniciada_em: null,
    finalizada_em: null,
    cancelada: false,
    motivo_cancelamento: null,
    historico: [],
    inspecoes: [],
    duracao_estimada_minutos: null,
    interrupcao: null,
  };
  // Evento do front/store (o backend não grava evento na chegada): ação, responsável e instante.
  registrarEvento(ctx, op, "CHEGADA", resp, "Chegada registrada.");
  e.operacoes.push(op);
  return { mensagem: `Chegada registrada: ${placa}.`, operacaoId: op.id };
}

/** `Operacao.validar_documentacao`. */
function validarDocumentacao(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, regular: boolean, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "AGUARDANDO_DOCUMENTACAO") {
    throw new ErroDeDominio("Documentação só pode ser validada na triagem.");
  }
  op.documentacao_regular = regular;
  if (regular) {
    mudarEstado(ctx, op, "AGUARDANDO_ENTRADA", resp);
    return { mensagem: `Documentação de ${placaDe(op)} validada. Aguardando entrada.` };
  }
  registrarOcorrencia(e, ctx, op, "DOCUMENTACAO_IRREGULAR", "Documentação irregular na chegada.", resp, {
    titulo: `${placaDe(op)} · documentação irregular`,
    metrica_rotulo: "na etapa",
  });
  return { mensagem: `Documentação irregular registrada para ${placaDe(op)}. Ocorrência aberta.` };
}

/** `Operacao.registrar_inspecao`. */
function registrarInspecao(ctx: Contexto, op: OperacaoE, resultado: string, aprovado: boolean, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "AGUARDANDO_INSPECAO") throw new ErroDeDominio("Caminhão não está aguardando inspeção.");
  if (!resultado.trim()) throw new ErroDeDominio("Informe o resultado da inspeção.");
  op.inspecoes.push({ resultado, responsavel_id: resp.id, realizada_em: ctx.agora.toISOString() });
  registrarEvento(ctx, op, "INSPECAO", resp, resultado);
  mudarEstado(ctx, op, aprovado ? "AGUARDANDO_ENTRADA" : "AGUARDANDO_DOCUMENTACAO", resp);
  return {
    mensagem: aprovado
      ? `Inspeção de ${placaDe(op)} aprovada. Aguardando entrada.`
      : `Inspeção de ${placaDe(op)} reprovada. Volta à documentação.`,
  };
}

/** `ServicoDominioTerminal.autorizar_entrada`. */
function autorizarEntrada(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, vagaId: string, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "AGUARDANDO_ENTRADA") throw new ErroDeDominio("Operação não está liberada para entrada.");
  const vaga = obterVaga(e, vagaId);
  if (!vagaAdequada(e, vaga, op)) throw new ErroDeDominio("Vaga indisponível ou inadequada para a carga.");
  vaga.estado = "OCUPADO";
  vaga.operacao_id = op.id;
  op.vaga_id = vaga.id;
  registrarEvento(ctx, op, "ALOCACAO_RECURSO", resp, "Vaga de pátio alocada na entrada.");
  mudarEstado(ctx, op, "NO_PATIO", resp);
  return { mensagem: `${placaDe(op)} autorizado a entrar na vaga ${vaga.codigo}.` };
}

/** `AlocadorDeRecursos.alocar_e_iniciar`. Sem conjunto completo não é erro: a operação passa a aguardar. */
function iniciarOperacao(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "NO_PATIO" && op.estado !== "AGUARDANDO_RECURSO") {
    throw new ErroDeDominio("Caminhão precisa estar no pátio ou aguardando recurso.");
  }
  if (resp.funcao !== "OPERADOR") throw new ErroDeDominio("Funcionário não tem função de operador.");
  if (!habilitado(resp, op.tipo)) {
    throw new ErroDeDominio(`Funcionário não está habilitado para ${habilitacaoPara(op.tipo)}.`);
  }

  const vagaAtual = op.vaga_id ? e.vagas.find((v) => v.id === op.vaga_id) : undefined;
  const vagaAtualValida =
    !!vagaAtual &&
    vagaAtual.estado === "OCUPADO" &&
    vagaAtual.operacao_id === op.id &&
    areaAdequada(areaDe(e, vagaAtual), op);
  const vaga = vagaAtualValida ? vagaAtual : e.vagas.find((v) => vagaAdequada(e, v, op));
  const doca = e.docas.find((d) => docaAdequada(e, d, op));
  const equipamento = e.equipamentos.find((q) => equipamentoCompativel(q, op));

  if (!vaga || !doca || !equipamento) {
    if (op.estado === "NO_PATIO") mudarEstado(ctx, op, "AGUARDANDO_RECURSO", resp);
    return {
      mensagem: `Sem recursos compatíveis livres. ${placaDe(op)} aguarda recurso.`,
      iniciada: false,
    };
  }

  /*
   * DIVERGÊNCIA DO BACK-END (sinalizada, não resolvida pelo front): em `main.py`,
   * `alocar_e_iniciar` chama `_mudar_estado(EM_OPERACAO)` direto de NO_PATIO, mas
   * TRANSICOES[NO_PATIO] só permite AGUARDANDO_RECURSO e AGUARDANDO_LIBERACAO. Com
   * recursos livres, o backend atual levantaria "Transição inválida". O README
   * descreve a sequência NO_PÁTIO → AGUARDANDO_RECURSO → EM_OPERAÇÃO; por isso o
   * motor passa pelas duas transições, ambas existentes na tabela, sem criar
   * nenhuma nova. Pendente de confirmação com o responsável pelo backend.
   */
  if (op.estado === "NO_PATIO") mudarEstado(ctx, op, "AGUARDANDO_RECURSO", resp);

  // Commit das reservas só depois de validar o conjunto completo.
  if (op.vaga_id && op.vaga_id !== vaga.id) {
    const antiga = e.vagas.find((v) => v.id === op.vaga_id);
    if (antiga) {
      antiga.estado = "LIVRE";
      antiga.operacao_id = null;
    }
  }
  vaga.estado = "OCUPADO";
  vaga.operacao_id = op.id;
  doca.estado = "OCUPADO";
  doca.operacao_id = op.id;
  equipamento.estado = "OCUPADO";
  equipamento.operacao_id = op.id;
  op.vaga_id = vaga.id;
  op.doca_id = doca.id;
  op.equipamento_id = equipamento.id;
  registrarEvento(ctx, op, "ALOCACAO_RECURSO", resp, "Vaga, doca e equipamento alocados.");
  mudarEstado(ctx, op, "EM_OPERACAO", resp);
  op.iniciada_em = op.iniciada_em ?? ctx.agora.toISOString();
  op.interrupcao = null;
  registrarEvento(ctx, op, "OPERACAO_INICIADA", resp, "Operação iniciada.");
  return {
    mensagem: `Operação de ${placaDe(op)} iniciada (${vaga.codigo}, ${doca.codigo}, ${equipamento.nome}).`,
    iniciada: true,
  };
}

/** `Operacao.interromper` + validações do endpoint `interrupt`. */
function interromper(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, a: Extract<Acao, { tipo: "interrupt" }>, resp: Funcionario): ResultadoAcao {
  if (!a.descricao.trim()) throw new ErroDeDominio("Informe a descrição da interrupção.");
  if (a.recurso) {
    const colecao =
      a.recurso.tipo === "area" ? e.areas
      : a.recurso.tipo === "vaga" ? e.vagas
      : a.recurso.tipo === "doca" ? e.docas
      : a.recurso.tipo === "equipment" ? e.equipamentos
      : null;
    if (!colecao) throw new ErroDeDominio("recurso_tipo deve ser area, vaga, doca ou equipment.");
    if (!colecao.some((r) => r.id === a.recurso!.id)) throw new ErroDeDominio("Recurso não encontrado.");
  }
  if (op.estado !== "NO_PATIO" && op.estado !== "AGUARDANDO_RECURSO" && op.estado !== "EM_OPERACAO") {
    throw new ErroDeDominio("Só é possível interromper uma operação no pátio ou em andamento.");
  }

  const estavaEmOperacao = op.estado === "EM_OPERACAO";
  const docaAnterior = op.doca_id;
  const minutosOperados = op.iniciada_em ? minutosEntre(op.iniciada_em, ctx.agora) : 0;

  const tipo: TipoOcorrencia = a.equipamentoQuebrado ? "EQUIPAMENTO_QUEBRADO" : "ATRASO";
  const equipamento = op.equipamento_id ? e.equipamentos.find((q) => q.id === op.equipamento_id) : undefined;
  const oc = registrarOcorrencia(e, ctx, op, tipo, a.descricao.trim(), resp, {
    severidade: a.severidade,
    impacto: a.impacto,
    recurso_tipo: a.recurso?.tipo ?? null,
    recurso_id: a.recurso?.id ?? null,
    titulo: a.equipamentoQuebrado && equipamento
      ? `${equipamento.nome} quebrado`
      : `${placaDe(op)} · operação interrompida`,
    metrica_rotulo: a.equipamentoQuebrado ? "espera máxima" : "parada",
  });
  if (a.equipamentoQuebrado && equipamento) equipamento.estado = "EM_MANUTENCAO";
  // A vaga do pátio é mantida enquanto o caminhão aguarda outro conjunto de recursos.
  liberarRecursos(e, op, true);
  if (estavaEmOperacao) {
    mudarEstado(ctx, op, "AGUARDANDO_RECURSO", resp);
    op.interrupcao = {
      doca_id: docaAnterior,
      interrompida_em: ctx.agora.toISOString(),
      minutos_operados: Math.round(minutosOperados),
      ocorrencia_id: oc.id,
    };
  }
  return { mensagem: `Operação de ${placaDe(op)} interrompida. Ocorrência aberta.` };
}

/** `Operacao.cancelar`. */
function cancelar(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, motivo: string, resp: Funcionario): ResultadoAcao {
  if (!motivo.trim()) throw new ErroDeDominio("Cancelamento exige motivo.");
  if (op.estado === "FINALIZADO" || op.estado === "AGUARDANDO_LIBERACAO") {
    throw new ErroDeDominio("Operação não pode ser cancelada neste estado.");
  }
  if (!transicaoPermitida(op.estado, "AGUARDANDO_LIBERACAO")) {
    throw new ErroDeDominio("Operação não pode ser cancelada neste estado.");
  }
  op.cancelada = true;
  op.motivo_cancelamento = motivo;
  registrarOcorrencia(e, ctx, op, "CANCELAMENTO", motivo, resp, {
    titulo: `${placaDe(op)} · cancelamento`,
  });
  liberarRecursos(e, op);
  op.interrupcao = null;
  mudarEstado(ctx, op, "AGUARDANDO_LIBERACAO", resp);
  return { mensagem: `Operação de ${placaDe(op)} cancelada. Aguardando liberação.` };
}

/** `ServicoDominioTerminal.finalizar_operacao`. */
function finalizar(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "EM_OPERACAO") throw new ErroDeDominio("Somente uma operação em andamento pode ser finalizada.");
  liberarRecursos(e, op);
  op.finalizada_em = ctx.agora.toISOString();
  mudarEstado(ctx, op, "AGUARDANDO_LIBERACAO", resp);
  registrarEvento(ctx, op, "OPERACAO_FINALIZADA", resp, "Operação concluída; aguardando liberação do caminhão.");
  return { mensagem: `Operação de ${placaDe(op)} finalizada. Aguardando liberação.` };
}

/** `ServicoDominioTerminal.liberar_caminhao`. */
function liberar(e: EstadoTerminal, ctx: Contexto, op: OperacaoE, resp: Funcionario): ResultadoAcao {
  if (op.estado !== "AGUARDANDO_LIBERACAO") throw new ErroDeDominio("Caminhão não está aguardando liberação.");
  liberarRecursos(e, op);
  mudarEstado(ctx, op, "FINALIZADO", resp);
  return { mensagem: `${placaDe(op)} liberado.` };
}

/** `POST /api/occurrences/{id}/resolve` + `Ocorrencia.resolver`. Não altera operação nem recursos. */
function resolverOcorrencia(e: EstadoTerminal, ctx: Contexto, ocorrenciaId: string, resp: Funcionario): ResultadoAcao {
  if (!ehSupervisao(resp)) throw new ErroDeDominio("Ação reservada à supervisão ou administração.");
  const oc = e.ocorrencias.find((o) => o.id === ocorrenciaId);
  if (!oc) throw new ErroDeDominio("Ocorrência não encontrada.");
  if (oc.estado === "RESOLVIDA") throw new ErroDeDominio("Ocorrência já está resolvida.");
  oc.estado = "RESOLVIDA";
  oc.resolvida_por = resp.id;
  oc.resolvida_em = ctx.agora.toISOString();
  const op = e.operacoes.find((o) => o.id === oc.operacao_id);
  // O backend grava o id da ocorrência no texto; aqui o texto é legível (só apresentação).
  if (op) registrarEvento(ctx, op, "OCORRENCIA", resp, `Ocorrência resolvida: ${oc.titulo ?? oc.descricao}`);
  return { mensagem: "Ocorrência resolvida." };
}

/** `PATCH /api/resources/{tipo}/{id}/maintenance`. */
function alterarManutencao(e: EstadoTerminal, a: Extract<Acao, { tipo: "maintenance" }>, resp: Funcionario): ResultadoAcao {
  if (!ehSupervisao(resp)) throw new ErroDeDominio("Ação reservada à supervisão ou administração.");
  const recurso =
    a.recurso.tipo === "vaga" ? e.vagas.find((r) => r.id === a.recurso.id)
    : a.recurso.tipo === "doca" ? e.docas.find((r) => r.id === a.recurso.id)
    : e.equipamentos.find((r) => r.id === a.recurso.id);
  if (!recurso) throw new ErroDeDominio("Recurso não encontrado.");
  if (recurso.estado === "OCUPADO") throw new ErroDeDominio("Não é possível alterar manutenção de recurso ocupado.");
  if (a.recurso.tipo === "equipment") {
    recurso.estado = a.emManutencao ? "EM_MANUTENCAO" : "DISPONIVEL";
  } else {
    recurso.estado = a.emManutencao ? "EM_MANUTENCAO" : "LIVRE";
    if (!a.emManutencao && "manutencao_ate" in recurso) recurso.manutencao_ate = null;
  }
  const nome = "codigo" in recurso ? recurso.codigo : (recurso as { nome: string }).nome;
  return { mensagem: a.emManutencao ? `${nome} em manutenção.` : `${nome} fora de manutenção.` };
}

/** `PATCH /api/areas/{id}`. */
function alterarInterdicao(e: EstadoTerminal, a: Extract<Acao, { tipo: "area-interdicao" }>, resp: Funcionario): ResultadoAcao {
  if (!ehSupervisao(resp)) throw new ErroDeDominio("Ação reservada à supervisão ou administração.");
  const area = e.areas.find((x) => x.id === a.areaId);
  if (!area) throw new ErroDeDominio("Área não encontrada.");
  if (a.interditada && [...e.vagas, ...e.docas].some((r) => r.area_id === area.id && r.estado === "OCUPADO")) {
    throw new ErroDeDominio("Libere os recursos ocupados antes de interditar a área.");
  }
  area.interditada = a.interditada;
  area.motivo_interdicao = a.interditada ? (a.motivo?.trim() || null) : null;
  return { mensagem: a.interditada ? `${area.nome} interditada.` : `${area.nome} liberada.` };
}

/* ---------- Ponto de entrada ---------- */

export function executar(
  estado: EstadoTerminal,
  acao: Acao,
  ctx: Contexto,
): { estado: EstadoTerminal; resultado: ResultadoAcao } {
  const e = structuredClone(estado);
  const operacao = "operacaoId" in acao ? obterOperacao(e, acao.operacaoId) : undefined;
  const resp = responsavelPara(e, acao, operacao);
  let resultado: ResultadoAcao;
  switch (acao.tipo) {
    case "criar-operacao":
      resultado = criarOperacao(e, ctx, acao.dados, resp);
      break;
    case "documentation":
      resultado = validarDocumentacao(e, ctx, operacao!, acao.regular, resp!);
      break;
    case "inspection":
      resultado = registrarInspecao(ctx, operacao!, acao.resultado, acao.aprovado, resp!);
      break;
    case "yard-entry":
      resultado = autorizarEntrada(e, ctx, operacao!, acao.vagaId, resp!);
      break;
    case "start":
      resultado = iniciarOperacao(e, ctx, operacao!, resp!);
      break;
    case "interrupt":
      resultado = interromper(e, ctx, operacao!, acao, resp!);
      break;
    case "cancel":
      resultado = cancelar(e, ctx, operacao!, acao.motivo, resp!);
      break;
    case "finish":
      resultado = finalizar(e, ctx, operacao!, resp!);
      break;
    case "release":
      resultado = liberar(e, ctx, operacao!, resp!);
      break;
    case "resolve-occurrence":
      resultado = resolverOcorrencia(e, ctx, acao.ocorrenciaId, resp!);
      break;
    case "maintenance":
      resultado = alterarManutencao(e, acao, resp!);
      break;
    case "area-interdicao":
      resultado = alterarInterdicao(e, acao, resp!);
      break;
  }
  return { estado: e, resultado };
}

/** Ids novos no navegador e no Node (testes podem injetar um gerador fixo). */
export const novoIdPadrao = () => globalThis.crypto.randomUUID();
export { exige };
