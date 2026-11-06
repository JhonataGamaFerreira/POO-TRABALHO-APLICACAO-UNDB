import { cn } from "@/lib/utils";
import type { NivelVisual } from "@/lib/terminal";

/** Glifo de severidade: losango (crítico) ou triângulo (atenção). Sempre com texto ao lado ou aria-label. */
export function SeverityGlyph({
  nivel,
  className,
}: {
  nivel: Exclude<NivelVisual, "none">;
  className?: string;
}) {
  if (nivel === "critical") {
    return (
      <svg
        viewBox="0 0 13 13"
        className={cn("size-[13px] shrink-0", className)}
        aria-hidden="true"
      >
        <path d="M6.5 0 13 6.5 6.5 13 0 6.5Z" fill="var(--severity-critical-solid)" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 11 10"
      className={cn("h-[10px] w-[11px] shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M5.5 0 11 10H0Z" fill="var(--severity-attention-solid)" />
    </svg>
  );
}

/** Severity Indicator (DS 09.10): glifo + rótulo opcional. */
export function SeverityIndicator({
  nivel,
  rotulo,
  mostrarRotulo = true,
  className,
}: {
  nivel: NivelVisual;
  /** Texto real da severidade (backend), ex.: "Crítica", "Média". */
  rotulo: string;
  mostrarRotulo?: boolean;
  className?: string;
}) {
  if (nivel === "none") {
    return mostrarRotulo ? (
      <span className={cn("text-xs font-bold tracking-[0.5px] text-t2 uppercase", className)}>
        {rotulo}
      </span>
    ) : null;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        nivel === "critical" ? "text-critical" : "text-attention",
        className,
      )}
      title={`Severidade ${rotulo}`}
    >
      <SeverityGlyph nivel={nivel} />
      {mostrarRotulo ? (
        <span className="text-xs font-bold tracking-[0.5px] uppercase">{rotulo}</span>
      ) : (
        <span className="sr-only">Severidade {rotulo}</span>
      )}
    </span>
  );
}

/**
 * Visuais de recurso do DS. `interrupted` e `blocked` usam tokens PENDENTES
 * (dependem de definição do back-end sobre os estados Interrompida e
 * Bloqueado/Quebrado); são representação visual, não estado da API.
 */
export type VisualRecurso = "free" | "occupied" | "interrupted" | "maintenance" | "blocked";

/** Estilo de superfície de cada visual (borda + fundo). Compartilhado por swatch e células. */
export const estiloVisual: Record<VisualRecurso, string> = {
  free: "border-[1.5px] border-line-brand bg-surface",
  occupied: "border border-line-resource bg-occupied",
  interrupted: "border-[1.5px] border-dashed border-attention bg-sev-attention-bg",
  maintenance: "hatch-maintenance border border-line-pattern",
  blocked: "hatch-blocked border border-blocked-line/60",
};

/** Pausa (operação interrompida). Sempre acompanhada do texto "Interrompida". */
export function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={cn("size-2.5 shrink-0", className)} aria-hidden="true">
      <rect x="1.5" y="1" width="2.5" height="8" fill="var(--severity-attention-solid)" />
      <rect x="6" y="1" width="2.5" height="8" fill="var(--severity-attention-solid)" />
    </svg>
  );
}

/** Resource Swatch (DS 09.10): amostra de 20 px do estado do recurso. */
export function ResourceSwatch({
  visual,
  className,
}: {
  visual: VisualRecurso;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-5 shrink-0 rounded-ds-sm",
        estiloVisual[visual],
        className,
      )}
    />
  );
}

/** Resource Tag (DS 09.10): MANUT. / INTERD. sobre áreas hachuradas. */
export function ResourceTag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "maintenance" | "blocked";
}) {
  return (
    <span
      className={cn(
        "rounded-ds-sm bg-surface px-1 text-xs font-bold tracking-[0.5px] uppercase",
        tone === "blocked" ? "text-critical" : "text-t2",
      )}
    >
      {children}
    </span>
  );
}
