"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { montarContexto, type TerminalCarregado } from "@/lib/terminal-contexto";
import { useTerminal } from "./use-terminal";

/** Terminal + índices e junções das telas; `null` até a hidratação. */
export function useContextoTerminal(): TerminalCarregado | null {
  const dados = useTerminal();
  return useMemo(() => (dados ? montarContexto(dados.terminal, dados.agora) : null), [dados]);
}

/** Parâmetros da URL (seleção, filtro, busca) como objeto simples. */
export function useParametros(): Record<string, string> {
  const sp = useSearchParams();
  return useMemo(() => Object.fromEntries(sp.entries()), [sp]);
}
