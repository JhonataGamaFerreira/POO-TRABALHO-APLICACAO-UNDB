import { X } from "lucide-react";
import { Acao } from "@/components/terminal/actions";
import { FecharComEsc } from "./fechar-com-esc";

/**
 * Painel contextual reutilizável. Só existe enquanto há um elemento
 * selecionado; não é uma coluna fixa. Fechar volta para a tela de origem
 * preservando os demais parâmetros da URL (Esc também fecha).
 */
export function ContextPanel({
  rotulo,
  fecharHref,
  children,
}: {
  rotulo: string;
  fecharHref: string;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-label={rotulo}
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[400px] flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-5 shadow-xl xl:sticky xl:top-14 xl:z-auto xl:h-[calc(100vh-56px)] xl:shrink-0 xl:shadow-none"
    >
      <FecharComEsc href={fecharHref} />
      <div className="flex justify-end">
        <Acao href={fecharHref} variante="ghost" tamanho="sm">
          <X className="size-3.5" aria-hidden="true" />
          Fechar
        </Acao>
      </div>
      {children}
    </aside>
  );
}
