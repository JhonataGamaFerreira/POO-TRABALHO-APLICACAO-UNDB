"use client";

import { Dialog } from "radix-ui";
import { useMemo } from "react";
import { responsavelDaAcao, type Acao } from "@/domain";
import { useEstadoTerminal } from "@/store/use-terminal";
import type { TipoOperacao } from "@/types/terminal";
import { BotaoAcao, estiloAcao } from "./actions";

const ROTULO_FUNCAO = {
  RECEPCAO: "Recepção",
  INSPETOR: "Inspeção",
  OPERADOR: "Operação",
  SUPERVISOR: "Supervisão",
  ADMINISTRADOR: "Administração",
} as const;

/**
 * "Registrado por Marina Costa · Recepção", a partir do funcionário que o domínio
 * escolhe para a ação. Em `start` a habilitação depende do tipo da operação.
 */
export function useResponsavel(tipo: Acao["tipo"], operacao?: { tipo: TipoOperacao }): string | null {
  const estado = useEstadoTerminal();
  const tipoOperacao = operacao?.tipo;
  return useMemo(() => {
    if (!estado) return null;
    try {
      const f = responsavelDaAcao(estado, tipo, tipoOperacao ? { tipo: tipoOperacao } : undefined);
      return `${f.nome} · ${ROTULO_FUNCAO[f.funcao]}`;
    } catch {
      return null;
    }
  }, [estado, tipo, tipoOperacao]);
}

/** Rodapé padrão dos diálogos de ação: responsável, fechar e confirmar. */
export function Rodape({
  responsavel,
  confirmar,
  desabilitado,
  fechar = "Cancelar",
}: {
  responsavel: string | null;
  confirmar: string;
  desabilitado?: boolean;
  /** Rótulo do botão que fecha sem executar ("Voltar" quando "Cancelar" seria ambíguo). */
  fechar?: string;
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
        <Dialog.Close className={estiloAcao("ghost", "lg")}>{fechar}</Dialog.Close>
        <BotaoAcao type="submit" variante="primary" tamanho="lg" disabled={desabilitado}>
          {confirmar}
        </BotaoAcao>
      </div>
    </div>
  );
}

/** Bloco de informação do diálogo (resultado esperado, recursos alocados, avisos). */
export function Nota({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "atencao";
}) {
  return (
    <div
      className={
        tom === "atencao"
          ? "rounded-ds-lg border-[1.5px] border-attention bg-surface p-3 text-sm text-t1"
          : "rounded-ds-lg border border-line bg-canvas p-3 text-sm text-t2"
      }
    >
      {children}
    </div>
  );
}
