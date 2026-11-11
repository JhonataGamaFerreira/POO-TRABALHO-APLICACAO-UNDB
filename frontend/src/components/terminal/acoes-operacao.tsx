"use client";

import { Dialog } from "radix-ui";
import { ClipboardCheck, ClipboardList, DoorOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { ErroDeDominio, responsavelDaAcao, type Acao } from "@/domain";
import { etapaLonga } from "@/lib/terminal";
import type { TerminalCarregado } from "@/lib/terminal-contexto";
import { avisar } from "@/store/avisos";
import { useAcoes, useEstadoTerminal } from "@/store/use-terminal";
import type { Operacao } from "@/types/terminal";
import { BotaoAcao, estiloAcao } from "./actions";
import { CampoAreaTexto, CampoSelecao, Erro, Escolha, GrupoEscolha } from "./campos";
import { Dialogo } from "./dialogo";

type T = TerminalCarregado;

const ROTULO_FUNCAO = {
  RECEPCAO: "Recepção",
  INSPETOR: "Inspeção",
  OPERADOR: "Operação",
  SUPERVISOR: "Supervisão",
  ADMINISTRADOR: "Administração",
} as const;

/** "Registrado por Marina Costa · Recepção", a partir do funcionário que o domínio escolhe para a ação. */
function useResponsavel(tipo: Acao["tipo"]): string | null {
  const estado = useEstadoTerminal();
  return useMemo(() => {
    if (!estado) return null;
    try {
      const f = responsavelDaAcao(estado, tipo);
      return `${f.nome} · ${ROTULO_FUNCAO[f.funcao]}`;
    } catch {
      return null;
    }
  }, [estado, tipo]);
}

function Rodape({
  responsavel,
  confirmar,
  desabilitado,
}: {
  responsavel: string | null;
  confirmar: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      {responsavel && (
        <p className="flex justify-between gap-3 text-xs text-t2">
          <span>Registrado por</span>
          <span className="font-medium text-t1">{responsavel}</span>
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Dialog.Close className={estiloAcao("ghost", "lg")}>Cancelar</Dialog.Close>
        <BotaoAcao type="submit" variante="primary" tamanho="lg" disabled={desabilitado}>
          {confirmar}
        </BotaoAcao>
      </div>
    </div>
  );
}

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

/* ---------- Bloco "Próximo passo" do painel do caminhão ---------- */

const ACOES_DESTA_ETAPA = ["documentation", "inspection", "yard-entry"] as const;
type AcaoDaEtapa = (typeof ACOES_DESTA_ETAPA)[number];

const TEXTOS: Record<AcaoDaEtapa, { titulo: string; descricao: string; botao: string; Icone: typeof ClipboardList }> = {
  documentation: {
    titulo: "Validar documentação",
    descricao: "Confira a documentação do motorista e da carga.",
    botao: "Validar documentação",
    Icone: ClipboardList,
  },
  inspection: {
    titulo: "Registrar inspeção",
    descricao: "Registre o resultado da inspeção do caminhão.",
    botao: "Registrar inspeção",
    Icone: ClipboardCheck,
  },
  "yard-entry": {
    titulo: "Autorizar entrada",
    descricao: "Escolha a vaga em que o caminhão vai entrar no pátio.",
    botao: "Autorizar entrada",
    Icone: DoorOpen,
  },
};

/**
 * Ação da etapa atual do caminhão. A etapa e a ação vêm de `acoes_permitidas`
 * (domínio): fora dessas três etapas nada é oferecido nesta entrega. Para a
 * entrada, a lista de vagas e o motivo de cada recusa também vêm do domínio.
 */
export function AcoesOperacao({ op, t }: { op: Operacao; t: T }) {
  const [aberto, setAberto] = useState(false);
  const acao = ACOES_DESTA_ETAPA.find((a) => op.acoes_permitidas.includes(a));
  if (!acao) return null;

  const { titulo, descricao, botao, Icone } = TEXTOS[acao];
  const vagas = acao === "yard-entry" ? (t.entrada.find((x) => x.operacao_id === op.id)?.vagas ?? []) : [];
  const semVaga = acao === "yard-entry" && !vagas.some((v) => v.disponivel);
  const fechar = () => setAberto(false);

  return (
    <section
      aria-label="Próximo passo"
      className="flex flex-col gap-3 rounded-ds-lg border border-line-brand bg-selected p-3"
    >
      <div className="flex items-start gap-2.5">
        <Icone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-t1">Próximo passo</h3>
          <p className="text-sm text-t2">{descricao}</p>
        </div>
      </div>
      <BotaoAcao variante="primary" tamanho="lg" onClick={() => setAberto(true)} disabled={semVaga}>
        {botao}
      </BotaoAcao>
      {semVaga && (
        <p className="text-xs text-t2">
          Nenhuma vaga livre é compatível com esta carga no momento. A entrada fica disponível quando uma vaga for liberada.
        </p>
      )}

      <Dialogo aberto={aberto} aoMudar={setAberto} titulo={`${titulo} · ${op.caminhao.placa}`} descricao={op.carga.descricao}>
        {acao === "documentation" && <FormDocumentacao op={op} fechar={fechar} />}
        {acao === "inspection" && <FormInspecao op={op} fechar={fechar} />}
        {acao === "yard-entry" && <FormEntrada op={op} t={t} fechar={fechar} />}
      </Dialogo>
    </section>
  );
}
