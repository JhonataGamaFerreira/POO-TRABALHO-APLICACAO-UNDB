"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { Acao, EstadoTerminal, ResultadoAcao } from "@/domain";
import type { IdCenario } from "@/mocks/cenarios";
import { montarTerminal, type Terminal } from "./selecionar";
import {
  assinar,
  assinarRelogio,
  despachar,
  restaurarCenario,
  snapshot,
  snapshotRelogio,
  snapshotRelogioServidor,
  snapshotServidor,
} from "./terminal-store";

/** Estado normalizado; `null` até a hidratação (as telas mostram o esqueleto). */
export const useEstadoTerminal = (): EstadoTerminal | null =>
  useSyncExternalStore(assinar, snapshot, snapshotServidor);

/** Instante atual (ms) com resolução de minuto; `0` antes da hidratação. */
export const useAgora = (): number =>
  useSyncExternalStore(assinarRelogio, snapshotRelogio, snapshotRelogioServidor);

/** Terminal no formato consumido pelas telas, junto do instante usado nos cálculos. */
export function useTerminal(): { terminal: Terminal; agora: Date } | null {
  const estado = useEstadoTerminal();
  const agora = useAgora();
  return useMemo(
    () => (estado && agora ? { terminal: montarTerminal(estado, new Date(agora)), agora: new Date(agora) } : null),
    [estado, agora],
  );
}

const ACOES = { executar: despachar, restaurar: restaurarCenario } as const;

export const useAcoes = (): {
  executar: (acao: Acao) => ResultadoAcao;
  restaurar: (cenario?: IdCenario) => void;
} => ACOES;
