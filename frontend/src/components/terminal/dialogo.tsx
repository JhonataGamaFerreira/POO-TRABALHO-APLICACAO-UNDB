"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";

/**
 * Diálogo de ação (DS: mesma superfície do diálogo de confirmação). O conteúdo
 * só existe enquanto aberto; por isso o estado do formulário interno é
 * descartado ao fechar.
 */
export function Dialogo({
  aberto,
  aoMudar,
  titulo,
  descricao,
  children,
}: {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoMudar}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-ds-lg border border-line bg-surface p-5 shadow-lg outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="text-base font-semibold text-t1">{titulo}</Dialog.Title>
              {descricao ? (
                <Dialog.Description className="text-sm text-t2">{descricao}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-m-1 rounded-ds-sm p-1 text-t3 hover:text-t1 active:opacity-80"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
