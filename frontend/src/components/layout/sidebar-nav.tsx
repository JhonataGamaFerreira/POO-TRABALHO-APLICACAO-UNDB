"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  LayoutGrid,
  ListOrdered,
  TriangleAlert,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  rotulo: string;
  icone: LucideIcon;
}

const OPERACAO: Item[] = [
  { href: "/dashboard", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/fila", rotulo: "Fila", icone: ListOrdered },
  { href: "/patio", rotulo: "Pátio e docas", icone: LayoutGrid },
];

/** Telas previstas na arquitetura de informação e fora do MVP de hoje. */
const FORA_DO_MVP: Item[] = [
  { href: "#", rotulo: "Equipamentos", icone: Wrench },
  { href: "#", rotulo: "Caminhões", icone: Truck },
  { href: "#", rotulo: "Ocorrências", icone: TriangleAlert },
  { href: "#", rotulo: "Relatórios", icone: BarChart3 },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <>
    <nav
      aria-label="Navegação principal (compacta)"
      className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-2 md:hidden"
    >
      {OPERACAO.map(({ href, rotulo, icone: Icone }) => {
        const ativo = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 border-b-[3px] border-transparent px-3 py-3 text-sm whitespace-nowrap text-t2",
              ativo && "border-line-brand font-medium text-brand",
            )}
          >
            <Icone className="size-4" aria-hidden="true" />
            {rotulo}
          </Link>
        );
      })}
    </nav>
    <nav
      aria-label="Navegação principal"
      className="sticky top-14 hidden h-[calc(100vh-56px)] w-[88px] shrink-0 flex-col gap-1 border-r border-line bg-surface py-3 md:flex"
    >
      <p className="px-2 pb-1 text-[11px] tracking-wider text-t3 uppercase">Operação</p>
      {OPERACAO.map(({ href, rotulo, icone: Icone }) => {
        const ativo = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 border-l-[3px] border-transparent px-1 py-2.5 text-center text-xs text-t2 hover:bg-canvas",
              ativo && "border-line-brand bg-selected font-medium text-brand hover:bg-selected",
            )}
          >
            <Icone className="size-5" aria-hidden="true" />
            {rotulo}
          </Link>
        );
      })}
      <p className="mt-3 px-2 pb-1 text-[11px] tracking-wider text-t3 uppercase">Registros</p>
      {FORA_DO_MVP.map(({ rotulo, icone: Icone }) => (
        <span
          key={rotulo}
          aria-disabled="true"
          title="Prevista na arquitetura, fora do MVP de hoje"
          className="flex cursor-not-allowed flex-col items-center gap-1 px-1 py-2.5 text-center text-xs text-t3 opacity-70"
        >
          <Icone className="size-5" aria-hidden="true" />
          {rotulo}
        </span>
      ))}
    </nav>
    </>
  );
}
