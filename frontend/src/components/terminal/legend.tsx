import { ResourceSwatch, SeverityGlyph } from "./indicators";

/** Legenda de estados do recurso (backend) e de severidade (visual proposto). */
export function Legenda() {
  return (
    <div className="flex flex-col gap-2 text-sm text-t2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-t3">Estado do recurso</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="free" className="size-4" />Livre / disponível</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="occupied" className="size-4" />Ocupado / em uso</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="maintenance" className="size-4" />Em manutenção</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="blocked" className="size-4" />Área interditada</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-t3">Severidade da ocorrência</span>
        <span className="inline-flex items-center gap-2"><SeverityGlyph nivel="critical" />Crítica</span>
        <span className="inline-flex items-center gap-2"><SeverityGlyph nivel="attention" />Alta ou média</span>
        <span className="text-xs text-t3">
          Correspondência visual proposta; o texto sempre mostra a severidade informada pelo backend.
        </span>
      </div>
    </div>
  );
}
