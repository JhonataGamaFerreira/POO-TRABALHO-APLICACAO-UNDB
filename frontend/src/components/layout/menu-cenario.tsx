"use client";

import { AlertDialog, DropdownMenu } from "radix-ui";
import { Ellipsis, RotateCcw } from "lucide-react";
import { useState } from "react";
import { estiloAcao } from "@/components/terminal/actions";
import { avisar } from "@/store/avisos";
import { useAcoes } from "@/store/use-terminal";

/**
 * Menu discreto da barra superior. Hoje só tem "Restaurar cenário inicial", que
 * exige confirmação; o foco inicial do diálogo fica em "Cancelar".
 */
export function MenuCenario() {
  const { restaurar } = useAcoes();
  const [confirmando, setConfirmando] = useState(false);

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Mais opções"
            className="flex size-9 items-center justify-center rounded-ds-lg border border-transparent text-t2 hover:border-line hover:bg-canvas active:bg-selected data-[state=open]:border-line data-[state=open]:bg-canvas"
          >
            <Ellipsis className="size-5" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-56 rounded-ds-lg border border-line bg-surface p-1 shadow-md"
          >
            <DropdownMenu.Item
              onSelect={() => setConfirmando(true)}
              className="flex h-9 cursor-default items-center gap-2.5 rounded-ds-md px-3 text-sm text-t1 outline-none data-[highlighted]:bg-selected"
            >
              <RotateCcw className="size-4 text-t2" aria-hidden="true" />
              Restaurar cenário inicial
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <AlertDialog.Root open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-ds-lg border border-line bg-surface p-5 shadow-lg outline-none">
            <div className="flex flex-col gap-2">
              <AlertDialog.Title className="text-base font-semibold text-t1">
                Restaurar o cenário inicial?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-sm text-t2">
                Caminhões, ocupação de vagas, docas e equipamentos, ocorrências e histórico voltam ao
                cenário inicial, com os horários ajustados para agora. As alterações feitas até aqui
                serão descartadas.
              </AlertDialog.Description>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialog.Cancel className={estiloAcao("outline", "md")}>Cancelar</AlertDialog.Cancel>
              <AlertDialog.Action
                className={estiloAcao("primary", "md")}
                onClick={() => {
                  restaurar();
                  avisar("sucesso", "Cenário restaurado.");
                }}
              >
                Restaurar cenário
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
