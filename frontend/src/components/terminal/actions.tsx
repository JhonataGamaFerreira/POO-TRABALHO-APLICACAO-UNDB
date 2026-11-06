import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Botões e links de ação do DS (Button 09.9: Style × Size × State).
 * Estados cobertos: default, hover, focus-visible (anel global de 2 px), active
 * (pressionado) e selected (chips). Toda ação é um link de navegação.
 */
export type VarianteAcao = "primary" | "outline" | "ghost" | "link";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-ds-lg text-sm font-medium transition-colors select-none active:translate-y-px";

const variantes: Record<VarianteAcao, string> = {
  primary:
    "bg-line-brand text-on-brand hover:bg-primary-hover active:bg-primary-pressed",
  outline:
    "border border-line-brand bg-surface text-brand hover:bg-selected active:bg-on-brand-muted",
  ghost: "border border-line bg-surface text-t1 hover:bg-canvas active:bg-selected",
  link: "rounded-ds-sm px-0 text-brand underline-offset-4 hover:underline active:opacity-80",
};

const tamanhos = {
  md: "h-9 px-3.5",
  lg: "h-11 px-4",
  sm: "h-8 px-2.5",
} as const;

interface Props {
  variante?: VarianteAcao;
  tamanho?: keyof typeof tamanhos;
  children: React.ReactNode;
  className?: string;
  href: string;
  scroll?: boolean;
}

export function Acao({
  variante = "outline",
  tamanho = "md",
  children,
  className,
  href,
  scroll = false,
}: Props) {
  const classes = cn(
    base,
    variantes[variante],
    variante !== "link" && tamanhos[tamanho],
    className,
  );
  return (
    <Link href={href} scroll={scroll} className={classes}>
      {children}
    </Link>
  );
}

/**
 * Chip de filtro/seleção (Chip 09.9: Selected × State). `selecionado` usa o
 * preenchimento da marca; o contador, quando existir, fica no mesmo rótulo.
 */
export function ChipLink({
  href,
  selecionado,
  children,
  contagem,
}: {
  href: string;
  selecionado?: boolean;
  children: React.ReactNode;
  contagem?: number;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors active:translate-y-px",
        selecionado
          ? "border-line-brand bg-line-brand font-medium text-on-brand hover:bg-primary-hover"
          : "border-line-resource bg-surface text-t1 hover:bg-canvas active:bg-selected",
      )}
    >
      {children}
      {contagem !== undefined && (
        <span className={cn("font-mono text-xs", selecionado ? "text-on-brand-muted" : "text-t3")}>
          {contagem}
        </span>
      )}
    </Link>
  );
}
