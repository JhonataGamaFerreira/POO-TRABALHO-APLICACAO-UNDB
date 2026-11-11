"use client";

import Link from "next/link";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { assinarAvisos, fecharAviso, snapshotAvisos, snapshotAvisosServidor, type Aviso } from "@/store/avisos";

const ESTILO: Record<Aviso["tipo"], { borda: string; icone: string; Icone: typeof CheckCircle2 }> = {
  sucesso: { borda: "border-l-line-brand", icone: "text-brand", Icone: CheckCircle2 },
  atencao: { borda: "border-l-attention", icone: "text-attention", Icone: TriangleAlert },
  erro: { borda: "border-l-critical", icone: "text-critical", Icone: TriangleAlert },
};

/** Região de avisos (canto inferior direito). Erros usam `role="alert"`; os demais, `role="status"`. */
export function Avisos() {
  const avisos = useSyncExternalStore(assinarAvisos, snapshotAvisos, snapshotAvisosServidor);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {avisos.map((a) => {
        const { borda, icone, Icone } = ESTILO[a.tipo];
        return (
          <div
            key={a.id}
            role={a.tipo === "erro" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-ds-lg border border-l-4 border-line bg-surface px-4 py-3 text-sm text-t1 shadow-md",
              borda,
            )}
          >
            <Icone className={cn("mt-0.5 size-4 shrink-0", icone)} aria-hidden="true" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p>{a.texto}</p>
              {a.acao && (
                <Link
                  href={a.acao.href}
                  scroll={false}
                  onClick={() => fecharAviso(a.id)}
                  className="w-fit font-medium text-brand underline-offset-4 hover:underline active:opacity-80"
                >
                  {a.acao.rotulo}
                </Link>
              )}
            </div>
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
