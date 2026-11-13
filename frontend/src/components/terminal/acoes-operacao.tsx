"use client";

import {
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  LogOut,
  Play,
  RotateCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  ErroDeDominio,
  avaliarInicio,
  type AvaliacaoInicio,
  type OperacaoE,
} from "@/domain";
import { ROTULO_IMPACTO, etapaLonga, recursosDaOperacao } from "@/lib/terminal";
import type { TerminalCarregado } from "@/lib/terminal-contexto";
import { avisar } from "@/store/avisos";
import { useAcoes, useEstadoTerminal } from "@/store/use-terminal";
import type { ImpactoOcorrencia, Operacao, SeveridadeOcorrencia } from "@/types/terminal";
import { Nota, Rodape, useResponsavel } from "./acao-form";
import { BotaoAcao } from "./actions";
import { CampoAreaTexto, CampoSelecao, Erro, Escolha, GrupoEscolha } from "./campos";
import { Dialogo } from "./dialogo";

type T = TerminalCarregado;

/* ---------- Validar documentação ---------- */

function FormDocumentacao({ op, fechar }: { op: Operacao; fechar: () => void }) {
  const { executar } = useAcoes();
  const [resultado, setResultado] = useState<"regular" | "irregular" | "">("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("documentation");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!resultado) return;
    try {
      const r = executar({ tipo: "documentation", operacaoId: op.id, regular: resultado === "regular" });
      avisar(resultado === "regular" ? "sucesso" : "atencao", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível registrar a validação. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <GrupoEscolha
        legenda="Resultado da conferência"
        erro={tentou && !resultado ? "Selecione o resultado da conferência." : undefined}
      >
        <Escolha
          tipo="radio"
          name="documentacao"
          rotulo="Documentação regular"
          descricao={`Segue para ${etapaLonga("AGUARDANDO_ENTRADA").toLowerCase()}.`}
          checked={resultado === "regular"}
          onChange={() => setResultado("regular")}
          autoFocus
        />
        <Escolha
          tipo="radio"
          name="documentacao"
          rotulo="Documentação irregular"
          descricao={`Abre uma ocorrência e o caminhão permanece em ${etapaLonga("AGUARDANDO_DOCUMENTACAO").toLowerCase()}.`}
          checked={resultado === "irregular"}
          onChange={() => setResultado("irregular")}
        />
      </GrupoEscolha>
      <Rodape responsavel={responsavel} confirmar="Registrar validação" />
    </form>
  );
}

/* ---------- Registrar inspeção ---------- */

function FormInspecao({ op, fechar }: { op: Operacao; fechar: () => void }) {
  const { executar } = useAcoes();
  const [resultado, setResultado] = useState<"aprovada" | "reprovada" | "">("");
  const [texto, setTexto] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("inspection");

  const erroTexto = tentou && !texto.trim() ? "Descreva o resultado da inspeção." : undefined;
  const erroEscolha = tentou && !resultado ? "Selecione se a inspeção foi aprovada ou reprovada." : undefined;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!texto.trim() || !resultado) return;
    try {
      const r = executar({
        tipo: "inspection",
        operacaoId: op.id,
        resultado: texto.trim(),
        aprovado: resultado === "aprovada",
      });
      avisar(resultado === "aprovada" ? "sucesso" : "atencao", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível registrar a inspeção. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <CampoAreaTexto
        rotulo="Resultado da inspeção"
        placeholder="Ex.: Sem avarias, lacre íntegro."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={300}
        erro={erroTexto}
        autoFocus
      />
      <GrupoEscolha legenda="Parecer" erro={erroEscolha}>
        <Escolha
          tipo="radio"
          name="inspecao"
          rotulo="Aprovada"
          descricao={`Segue para ${etapaLonga("AGUARDANDO_ENTRADA").toLowerCase()}.`}
          checked={resultado === "aprovada"}
          onChange={() => setResultado("aprovada")}
        />
        <Escolha
          tipo="radio"
          name="inspecao"
          rotulo="Reprovada"
          descricao={`Volta para ${etapaLonga("AGUARDANDO_DOCUMENTACAO").toLowerCase()}.`}
          checked={resultado === "reprovada"}
          onChange={() => setResultado("reprovada")}
        />
      </GrupoEscolha>
      <Rodape responsavel={responsavel} confirmar="Registrar inspeção" />
    </form>
  );
}

/* ---------- Autorizar entrada ---------- */

function FormEntrada({ op, t, fechar }: { op: Operacao; t: T; fechar: () => void }) {
  const { executar } = useAcoes();
  const vagas = useMemo(() => t.entrada.find((x) => x.operacao_id === op.id)?.vagas ?? [], [t.entrada, op.id]);
  const livres = vagas.filter((v) => v.disponivel);
  const [vagaId, setVagaId] = useState(livres[0]?.vaga_id ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("yard-entry");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!vagaId) return;
    try {
      const r = executar({ tipo: "yard-entry", operacaoId: op.id, vagaId });
      avisar("sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível autorizar a entrada. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <CampoSelecao
        rotulo="Vaga no pátio"
        value={vagaId}
        onChange={(e) => setVagaId(e.target.value)}
        autoFocus
        dica={`${livres.length} ${livres.length === 1 ? "vaga livre compatível" : "vagas livres compatíveis"} com a carga.`}
        opcoes={vagas.map((v) => ({
          valor: v.vaga_id,
          rotulo: v.disponivel ? `${v.codigo} · ${v.area}` : `${v.codigo} · ${v.motivo}`,
          desabilitada: !v.disponivel,
        }))}
      />
      <Rodape responsavel={responsavel} confirmar="Autorizar entrada" desabilitado={!vagaId} />
    </form>
  );
}


/* ---------- Iniciar ou retomar ---------- */

/** Prévia do que o domínio vai alocar (a mesma escolha que `start` faz ao executar). */
function useAvaliacao(op: Operacao): { operacao: OperacaoE; avaliacao: AvaliacaoInicio } | null {
  const estado = useEstadoTerminal();
  return useMemo(() => {
    const operacao = estado?.operacoes.find((x) => x.id === op.id);
    return estado && operacao ? { operacao, avaliacao: avaliarInicio(estado, operacao) } : null;
  }, [estado, op.id]);
}

function ResumoRecursos({ itens }: { itens: Array<{ rotulo: string; valor: string | null | undefined }> }) {
  return (
    <dl className="flex flex-col gap-1 text-sm">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex justify-between gap-3">
          <dt className="text-t2">{i.rotulo}</dt>
          <dd className="font-mono font-medium text-t1">{i.valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function FormIniciar({ op, fechar }: { op: Operacao; fechar: () => void }) {
  const { executar } = useAcoes();
  const dados = useAvaliacao(op);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("start", op);
  if (!dados) return null;
  const a = dados.avaliacao;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = executar({ tipo: "start", operacaoId: op.id });
      avisar(r.iniciada ? "sucesso" : "atencao", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível iniciar a operação. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      {a.pode ? (
        <Nota>
          <p className="mb-2">
            {a.retomada
              ? "A operação volta pela alocação de recursos. Serão usados:"
              : "O sistema reserva os recursos abaixo e inicia a operação:"}
          </p>
          <ResumoRecursos
            itens={[
              { rotulo: "Vaga", valor: a.vaga?.codigo },
              { rotulo: "Doca", valor: a.doca?.codigo },
              { rotulo: "Equipamento", valor: a.equipamento?.nome },
            ]}
          />
        </Nota>
      ) : (
        <Nota tom="atencao">
          <p className="font-medium">Sem recursos disponíveis agora</p>
          <p className="text-t2">{a.motivo}.</p>
          <p className="mt-1 text-xs text-t2">
            O caminhão passa a aguardar recursos e continua na vaga. A ação volta a ficar disponível quando houver recursos.
          </p>
        </Nota>
      )}
      <Rodape
        responsavel={responsavel}
        confirmar={a.pode ? (a.retomada ? "Retomar operação" : "Iniciar operação") : "Aguardar recursos"}
      />
    </form>
  );
}

/* ---------- Concluir operação ---------- */

function FormConcluir({ op, t, fechar }: { op: Operacao; t: T; fechar: () => void }) {
  const { executar } = useAcoes();
  const rec = recursosDaOperacao(op, t.idx);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("finish");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = executar({ tipo: "finish", operacaoId: op.id });
      avisar("sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível concluir a operação. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <Nota>
        <p className="mb-2">
          A operação é encerrada, a vaga, a doca e o equipamento ficam livres e o caminhão segue para{" "}
          {etapaLonga("AGUARDANDO_LIBERACAO").toLowerCase()}.
        </p>
        <ResumoRecursos
          itens={[
            { rotulo: "Vaga", valor: rec.vaga },
            { rotulo: "Doca", valor: rec.doca },
            { rotulo: "Equipamento", valor: rec.equipamento },
          ]}
        />
      </Nota>
      <Rodape responsavel={responsavel} confirmar="Concluir operação" />
    </form>
  );
}

/* ---------- Liberar caminhão ---------- */

function FormLiberar({ op, fechar }: { op: Operacao; fechar: () => void }) {
  const { executar } = useAcoes();
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("release");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = executar({ tipo: "release", operacaoId: op.id });
      avisar("sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível liberar o caminhão. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <Nota>
        {op.cancelada
          ? `Operação cancelada${op.motivo_cancelamento ? `: ${op.motivo_cancelamento}` : ""}. `
          : "Operação concluída. "}
        Ao liberar, o atendimento termina e o caminhão deixa o terminal.
      </Nota>
      <Rodape responsavel={responsavel} confirmar="Liberar caminhão" />
    </form>
  );
}

/* ---------- Interromper operação ---------- */

const ROTULO_GRAVIDADE: Record<SeveridadeOcorrencia, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

function FormInterromper({ op, t, fechar }: { op: Operacao; t: T; fechar: () => void }) {
  const { executar } = useAcoes();
  const rec = recursosDaOperacao(op, t.idx);
  const [descricao, setDescricao] = useState("");
  const [severidade, setSeveridade] = useState<SeveridadeOcorrencia>("media");
  const [impacto, setImpacto] = useState<ImpactoOcorrencia>("operacao");
  const [quebrado, setQuebrado] = useState(false);
  const [recurso, setRecurso] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("interrupt");

  const opcoesRecurso = [
    { valor: "", rotulo: "Nenhum recurso específico" },
    ...(op.doca ? [{ valor: `doca:${op.doca.id}`, rotulo: `Doca ${rec.doca}` }] : []),
    ...(op.equipamento ? [{ valor: `equipment:${op.equipamento.id}`, rotulo: `Equipamento ${op.equipamento.nome}` }] : []),
    ...(op.vaga ? [{ valor: `vaga:${op.vaga.id}`, rotulo: `Vaga ${rec.vaga}` }] : []),
  ];

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!descricao.trim()) return;
    const [tipo, id] = recurso.split(":");
    try {
      const r = executar({
        tipo: "interrupt",
        operacaoId: op.id,
        descricao: descricao.trim(),
        equipamentoQuebrado: quebrado,
        severidade,
        impacto,
        recurso: !quebrado && tipo && id ? { tipo: tipo as "doca" | "equipment" | "vaga", id } : null,
      });
      avisar("atencao", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível interromper a operação. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <CampoAreaTexto
        rotulo="O que aconteceu"
        placeholder="Ex.: Operador ausente da doca durante a descarga."
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        maxLength={300}
        erro={tentou && !descricao.trim() ? "Descreva o motivo da interrupção." : undefined}
        autoFocus
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelecao
          rotulo="Gravidade"
          value={severidade}
          onChange={(e) => setSeveridade(e.target.value as SeveridadeOcorrencia)}
          opcoes={(Object.keys(ROTULO_GRAVIDADE) as SeveridadeOcorrencia[]).map((v) => ({
            valor: v,
            rotulo: ROTULO_GRAVIDADE[v],
          }))}
        />
        <CampoSelecao
          rotulo="Impacto"
          value={impacto}
          onChange={(e) => setImpacto(e.target.value as ImpactoOcorrencia)}
          opcoes={(Object.keys(ROTULO_IMPACTO) as ImpactoOcorrencia[]).map((v) => ({
            valor: v,
            rotulo: ROTULO_IMPACTO[v],
          }))}
        />
      </div>
      {op.equipamento && (
        <GrupoEscolha legenda="Equipamento">
          <Escolha
            tipo="checkbox"
            name="equipamento-quebrado"
            rotulo={`${op.equipamento.nome} quebrou`}
            descricao="O equipamento vai para manutenção e passa a ser o recurso da ocorrência."
            checked={quebrado}
            onChange={(e) => setQuebrado(e.target.checked)}
          />
        </GrupoEscolha>
      )}
      {!quebrado && opcoesRecurso.length > 1 && (
        <CampoSelecao
          rotulo="Recurso envolvido"
          value={recurso}
          onChange={(e) => setRecurso(e.target.value)}
          opcoes={opcoesRecurso}
        />
      )}
      <Nota>
        A operação volta para {etapaLonga("AGUARDANDO_RECURSO").toLowerCase()}, libera a doca e o equipamento e mantém a vaga.
        Para retomar, ela passa de novo pela alocação de recursos.
      </Nota>
      <Rodape responsavel={responsavel} confirmar="Interromper operação" />
    </form>
  );
}

/* ---------- Cancelar operação ---------- */

function FormCancelar({ op, fechar }: { op: Operacao; fechar: () => void }) {
  const { executar } = useAcoes();
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("cancel");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!motivo.trim()) return;
    try {
      const r = executar({ tipo: "cancel", operacaoId: op.id, motivo: motivo.trim() });
      avisar("atencao", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível cancelar a operação. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      <CampoAreaTexto
        rotulo="Motivo do cancelamento"
        placeholder="Ex.: Transportadora desistiu da operação."
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        maxLength={300}
        erro={tentou && !motivo.trim() ? "Informe o motivo do cancelamento." : undefined}
        autoFocus
      />
      <Nota tom="atencao">
        <p className="font-medium">O cancelamento não pode ser desfeito.</p>
        <p className="text-t2">
          Registra uma ocorrência, libera a vaga e leva o caminhão para {etapaLonga("AGUARDANDO_LIBERACAO").toLowerCase()}.
          Ele só deixa o terminal quando for liberado.
        </p>
      </Nota>
      <Rodape responsavel={responsavel} confirmar="Cancelar operação" fechar="Voltar" />
    </form>
  );
}

/* ---------- Bloco "Próximo passo" do painel do caminhão ---------- */

const PRIMARIAS = ["documentation", "inspection", "yard-entry", "start", "finish", "release"] as const;
type Primaria = (typeof PRIMARIAS)[number];
type Painel = Primaria | "interrupt" | "cancel";

const TEXTOS: Record<Primaria, { titulo: string; botao: string; Icone: typeof ClipboardList }> = {
  documentation: { titulo: "Validar documentação", botao: "Validar documentação", Icone: ClipboardList },
  inspection: { titulo: "Registrar inspeção", botao: "Registrar inspeção", Icone: ClipboardCheck },
  "yard-entry": { titulo: "Autorizar entrada", botao: "Autorizar entrada", Icone: DoorOpen },
  start: { titulo: "Iniciar operação", botao: "Iniciar operação", Icone: Play },
  finish: { titulo: "Concluir operação", botao: "Concluir operação", Icone: CircleCheck },
  release: { titulo: "Liberar caminhão", botao: "Liberar caminhão", Icone: LogOut },
};

const juntarCodigos = (itens: Array<string | undefined>) => itens.filter(Boolean).join(" · ");

/**
 * Ação da etapa atual do caminhão. A etapa e a ação vêm de `acoes_permitidas`
 * (domínio). Documentação, inspeção e entrada só existem nas etapas de triagem;
 * iniciar/retomar, concluir e liberar cobrem a execução. Interromper e cancelar
 * são ações secundárias, oferecidas quando a etapa as permite. A prévia de
 * alocação e a lista de vagas vêm do domínio (nada é decidido aqui).
 */
export function AcoesOperacao({ op, t }: { op: Operacao; t: T }) {
  const [aberto, setAberto] = useState<Painel | null>(null);
  const dados = useAvaliacao(op);
  const acao = PRIMARIAS.find((a) => op.acoes_permitidas.includes(a));
  const podeInterromper = op.estado === "EM_OPERACAO" && op.acoes_permitidas.includes("interrupt");
  const podeCancelar = op.acoes_permitidas.includes("cancel");
  if (!acao && !podeInterromper && !podeCancelar) return null;

  const fechar = () => setAberto(null);
  const a = dados?.avaliacao;
  const rec = recursosDaOperacao(op, t.idx);
  const retomada = acao === "start" && !!a?.retomada;
  const vagas = acao === "yard-entry" ? (t.entrada.find((x) => x.operacao_id === op.id)?.vagas ?? []) : [];
  const semVaga = acao === "yard-entry" && !vagas.some((v) => v.disponivel);
  const esperandoRecurso = acao === "start" && op.estado === "AGUARDANDO_RECURSO" && !!a && !a.pode;

  let titulo = acao ? TEXTOS[acao].titulo : "";
  let botao = acao ? TEXTOS[acao].botao : "";
  let Icone = acao ? TEXTOS[acao].Icone : ClipboardList;
  let descricao = "";
  switch (acao) {
    case "documentation":
      descricao = "Confira a documentação do motorista e da carga.";
      break;
    case "inspection":
      descricao = "Registre o resultado da inspeção do caminhão.";
      break;
    case "yard-entry":
      descricao = "Escolha a vaga em que o caminhão vai entrar no pátio.";
      break;
    case "start":
      if (retomada) {
        titulo = "Retomar operação";
        botao = "Retomar operação";
        Icone = RotateCw;
      } else if (esperandoRecurso) {
        botao = "Aguardando recursos";
      }
      descricao = !a
        ? ""
        : a.pode
          ? `${retomada ? "Recursos disponíveis para retomar" : "Recursos disponíveis"}: ${juntarCodigos([a.vaga?.codigo, a.doca?.codigo, a.equipamento?.nome])}.`
          : `${a.motivo}.${esperandoRecurso ? " A operação continua assim que houver recurso." : " Ao iniciar, o caminhão passa a aguardar recursos."}`;
      break;
    case "finish":
      descricao = `Em operação${rec.doca ? ` na ${rec.doca}` : ""}${op.equipamento ? ` com ${op.equipamento.nome}` : ""}. Conclua quando a ${op.tipo === "carga" ? "carga" : "descarga"} terminar.`;
      break;
    case "release":
      descricao = op.cancelada
        ? "Operação cancelada. Libere o caminhão para encerrar o atendimento."
        : "Operação concluída. Libere o caminhão para encerrar o atendimento.";
      break;
  }

  return (
    <section
      aria-label="Próximo passo"
      className="flex flex-col gap-3 rounded-ds-lg border border-line-brand bg-selected p-3"
    >
      {acao && (
        <>
          <div className="flex items-start gap-2.5">
            <Icone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="text-sm font-semibold text-t1">Próximo passo</h3>
              <p className="text-sm text-t2">{descricao}</p>
            </div>
          </div>
          <BotaoAcao
            variante="primary"
            tamanho="lg"
            onClick={() => setAberto(acao)}
            disabled={semVaga || esperandoRecurso}
          >
            {botao}
          </BotaoAcao>
          {semVaga && (
            <p className="text-xs text-t2">
              Nenhuma vaga livre é compatível com esta carga no momento. A entrada fica disponível quando uma vaga for liberada.
            </p>
          )}
        </>
      )}
      {(podeInterromper || podeCancelar) && (
        <div className="flex flex-wrap gap-2">
          {podeInterromper && (
            <BotaoAcao variante="outline" tamanho="md" className="flex-1" onClick={() => setAberto("interrupt")}>
              Interromper
            </BotaoAcao>
          )}
          {podeCancelar && (
            <BotaoAcao variante="ghost" tamanho="md" className="flex-1" onClick={() => setAberto("cancel")}>
              Cancelar operação
            </BotaoAcao>
          )}
        </div>
      )}

      <Dialogo
        aberto={aberto !== null}
        aoMudar={(v) => !v && fechar()}
        titulo={`${
          aberto === "interrupt"
            ? "Interromper operação"
            : aberto === "cancel"
              ? "Cancelar operação"
              : aberto === "start"
                ? titulo
                : aberto
                  ? TEXTOS[aberto].titulo
                  : ""
        } · ${op.caminhao.placa}`}
        descricao={op.carga.descricao}
      >
        {aberto === "documentation" && <FormDocumentacao op={op} fechar={fechar} />}
        {aberto === "inspection" && <FormInspecao op={op} fechar={fechar} />}
        {aberto === "yard-entry" && <FormEntrada op={op} t={t} fechar={fechar} />}
        {aberto === "start" && <FormIniciar op={op} fechar={fechar} />}
        {aberto === "finish" && <FormConcluir op={op} t={t} fechar={fechar} />}
        {aberto === "release" && <FormLiberar op={op} fechar={fechar} />}
        {aberto === "interrupt" && <FormInterromper op={op} t={t} fechar={fechar} />}
        {aberto === "cancel" && <FormCancelar op={op} fechar={fechar} />}
      </Dialogo>
    </section>
  );
}
