"use client";

import { useState } from "react";
import { ErroDeDominio } from "@/domain";
import type { TerminalCarregado } from "@/lib/terminal-contexto";
import { avisar } from "@/store/avisos";
import { useAcoes } from "@/store/use-terminal";
import type { TipoOcorrencia } from "@/types/terminal";
import { Nota, Rodape, useResponsavel } from "./acao-form";
import { BotaoAcao } from "./actions";
import { CampoAreaTexto, Erro } from "./campos";
import { Dialogo } from "./dialogo";

type T = TerminalCarregado;

/* ---------- Resolver ocorrência ---------- */

function FormResolver({
  ocorrenciaId,
  tipo,
  fechar,
}: {
  ocorrenciaId: string;
  tipo: TipoOcorrencia;
  fechar: () => void;
}) {
  const { executar } = useAcoes();
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("resolve-occurrence");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = executar({ tipo: "resolve-occurrence", ocorrenciaId });
      avisar("sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível resolver a ocorrência. Tente novamente.");
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
        <p>A ocorrência sai da lista de abertas e o encerramento fica registrado no histórico da operação.</p>
        <p className="mt-1 text-xs">
          {tipo === "EQUIPAMENTO_QUEBRADO"
            ? "O equipamento continua em manutenção até a manutenção ser concluída no painel do recurso."
            : "Resolver não muda a etapa do caminhão nem libera recursos."}
        </p>
      </Nota>
      <Rodape responsavel={responsavel} confirmar="Resolver ocorrência" />
    </form>
  );
}

/** Ação de uma ocorrência aberta (painel de detalhe). */
export function AcoesOcorrencia({ id, tipo, aberta }: { id: string; tipo: TipoOcorrencia; aberta: boolean }) {
  const [aberto, setAberto] = useState(false);
  if (!aberta) return null;
  return (
    <>
      <BotaoAcao variante="outline" tamanho="lg" onClick={() => setAberto(true)}>
        Resolver ocorrência
      </BotaoAcao>
      <Dialogo
        aberto={aberto}
        aoMudar={setAberto}
        titulo="Resolver ocorrência"
        descricao="Confirme que a situação foi tratada."
      >
        <FormResolver ocorrenciaId={id} tipo={tipo} fechar={() => setAberto(false)} />
      </Dialogo>
    </>
  );
}

/* ---------- Manutenção e interdição ---------- */

type TipoRecurso = "vaga" | "doca" | "equipment";

function FormManutencao({
  tipo,
  id,
  nome,
  entrar,
  fechar,
}: {
  tipo: TipoRecurso;
  id: string;
  nome: string;
  /** true: colocar em manutenção; false: concluir a manutenção. */
  entrar: boolean;
  fechar: () => void;
}) {
  const { executar } = useAcoes();
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("maintenance");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      const r = executar({ tipo: "maintenance", recurso: { tipo, id }, emManutencao: entrar });
      avisar(entrar ? "atencao" : "sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível atualizar a manutenção. Tente novamente.");
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
        {entrar
          ? `${nome} fica indisponível para novas alocações até a manutenção ser concluída.`
          : `${nome} volta a ficar disponível e pode ser alocado a uma operação, inclusive a retomadas.`}
      </Nota>
      <Rodape responsavel={responsavel} confirmar={entrar ? "Colocar em manutenção" : "Concluir manutenção"} />
    </form>
  );
}

function FormInterdicao({
  areaId,
  areaNome,
  interditar,
  fechar,
}: {
  areaId: string;
  areaNome: string;
  interditar: boolean;
  fechar: () => void;
}) {
  const { executar } = useAcoes();
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const responsavel = useResponsavel("area-interdicao");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (interditar && !motivo.trim()) return;
    try {
      const r = executar({
        tipo: "area-interdicao",
        areaId,
        interditada: interditar,
        motivo: interditar ? motivo.trim() : null,
      });
      avisar(interditar ? "atencao" : "sucesso", r.mensagem);
      fechar();
    } catch (x) {
      setErro(x instanceof ErroDeDominio ? x.message : "Não foi possível atualizar a área. Tente novamente.");
    }
  }

  return (
    <form noValidate onSubmit={enviar} className="flex flex-col gap-4">
      {erro && (
        <div role="alert">
          <Erro>{erro}</Erro>
        </div>
      )}
      {interditar ? (
        <>
          <CampoAreaTexto
            rotulo="Motivo da interdição"
            placeholder="Ex.: Piso danificado."
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={200}
            erro={tentou && !motivo.trim() ? "Informe o motivo da interdição." : undefined}
            autoFocus
          />
          <Nota>
            As vagas e docas da área {areaNome} ficam bloqueadas para novas alocações. A interdição só é possível
            quando nenhum recurso da área está ocupado.
          </Nota>
        </>
      ) : (
        <Nota>As vagas e docas da área {areaNome} voltam a ficar disponíveis para alocação.</Nota>
      )}
      <Rodape responsavel={responsavel} confirmar={interditar ? "Interditar área" : "Liberar área"} />
    </form>
  );
}

/**
 * Ações de disponibilidade de um recurso (painel de detalhe): manutenção
 * (vaga, doca, equipamento) e interdição da área (vaga, doca). As regras
 * (recurso ocupado, área com recursos em uso) são do domínio; um recurso em
 * uso só mostra o botão desabilitado com o motivo.
 */
export function AcoesRecurso({ t, tipo, id }: { t: T; tipo: TipoRecurso; id: string }) {
  const [aberto, setAberto] = useState<"manutencao" | "area" | null>(null);

  const recurso =
    tipo === "vaga"
      ? t.idx.vagaPorId.get(id)
      : tipo === "doca"
        ? t.idx.docaPorId.get(id)
        : t.idx.equipPorId.get(id);
  if (!recurso) return null;
  const nome =
    tipo === "vaga"
      ? `Vaga ${t.idx.codigoVaga.get(id) ?? ""}`
      : tipo === "doca"
        ? `Doca ${t.idx.codigoDoca.get(id) ?? ""}`
        : (t.idx.equipPorId.get(id)?.nome ?? "Equipamento");
  const area = "area" in recurso ? recurso.area : null;
  const emManutencao = recurso.estado === "EM_MANUTENCAO";
  const ocupado = recurso.estado === "OCUPADO";
  const fechar = () => setAberto(null);

  return (
    <div className="flex flex-col gap-2">
      <BotaoAcao variante="outline" tamanho="md" onClick={() => setAberto("manutencao")} disabled={ocupado}>
        {emManutencao ? "Concluir manutenção" : "Colocar em manutenção"}
      </BotaoAcao>
      {ocupado && (
        <p className="text-xs text-t3">
          Recurso em uso. A manutenção fica disponível depois que a operação for concluída ou interrompida.
        </p>
      )}
      {area && (
        <BotaoAcao variante="ghost" tamanho="md" onClick={() => setAberto("area")}>
          {area.interditada ? `Liberar área ${area.nome}` : `Interditar área ${area.nome}`}
        </BotaoAcao>
      )}

      <Dialogo
        aberto={aberto !== null}
        aoMudar={(v) => !v && fechar()}
        titulo={
          aberto === "area"
            ? `${area?.interditada ? "Liberar" : "Interditar"} área ${area?.nome ?? ""}`
            : `${emManutencao ? "Concluir manutenção" : "Manutenção"} · ${nome}`
        }
      >
        {aberto === "manutencao" && (
          <FormManutencao tipo={tipo} id={id} nome={nome} entrar={!emManutencao} fechar={fechar} />
        )}
        {aberto === "area" && area && (
          <FormInterdicao areaId={area.id} areaNome={area.nome} interditar={!area.interditada} fechar={fechar} />
        )}
      </Dialogo>
    </div>
  );
}
