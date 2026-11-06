import { Search } from "lucide-react";
import { formatarHora } from "@/lib/terminal";
import { REFERENCIA_SIMULADA } from "@/services/terminal";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-surface px-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-ds-md bg-line-brand text-xs font-semibold text-on-brand"
        >
          TP
        </span>
        <span className="hidden text-base font-semibold text-t1 sm:inline">
          Terminal Portuário
        </span>
      </div>

      <form action="/fila" role="search" className="mx-auto w-full max-w-[440px]">
        <label className="relative block">
          <span className="sr-only">Buscar caminhão por placa</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-t3"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            placeholder="Buscar placa do caminhão"
            className="h-9 w-full rounded-ds-lg border border-line-resource bg-surface pr-3 pl-9 text-sm text-t1 placeholder:text-t3"
          />
        </label>
      </form>

      <span className="hidden text-sm text-t3 lg:inline">
        Atualizado às {formatarHora(REFERENCIA_SIMULADA)}
      </span>
    </header>
  );
}
