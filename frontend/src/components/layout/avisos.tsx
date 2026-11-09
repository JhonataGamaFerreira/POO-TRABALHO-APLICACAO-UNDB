"use client";

import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { assinarAvisos, fecharAviso, snapshotAvisos, snapshotAvisosServidor } from "@/store/avisos";

/** Região de avisos (canto inferior direito). Erros usam `role="alert"`; sucessos, `role="status"`. */
export function Avisos() {
  const avisos = useSyncExternalStore(assinarAvisos, snapshotAvisos, snapshotAvisosServidor);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {avisos.map((a) => {
        const erro = a.tipo === "erro";
        const Icone = erro ? TriangleAlert : CheckCircle2;
        return (
          <div
            key={a.id}
            role={erro ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-ds-lg border border-l-4 bg-surface px-4 py-3 text-sm text-t1 shadow-md",
              erro ? "border-line border-l-critical" : "border-line border-l-line-brand",
            )}
          >
            <Icone
              className={cn("mt-0.5 size-4 shrink-0", erro ? "text-critical" : "text-brand")}
              aria-hidden="true"
            />
            <p className="min-w-0 flex-1">{a.texto}</p>
            <button
              type="button"
              onClick={() => fecharAviso(a.id)}
              className="-m-1 rounded-ds-sm p-1 text-t3 hover:text-t1"
              aria-label="Fechar aviso"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
