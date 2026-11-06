import { ResourceSwatch, SeverityGlyph } from "./indicators";

/**
 * Legenda do wireframe (A1/B1), organizada em três grupos que não se misturam:
 *  - estado do recurso (livre, ocupado, em manutenção);
 *  - condições operacionais ou de restrição (interrupção, área interditada,
 *    equipamento quebrado), que explicam um recurso mas não são estado dele;
 *  - severidade da ocorrência (crítico, atenção).
 * Área interditada e equipamento quebrado compartilham o mesmo padrão visual.
 */
export function Legenda() {
  return (
    <div className="flex flex-col gap-2 text-sm text-t2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-medium text-t3">Estado do recurso</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="free" className="size-4" />Livre</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="occupied" className="size-4" />Ocupado</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="maintenance" className="size-4" />Em manutenção</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-medium text-t3">Condições</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="interrupted" className="size-4" />Interrupção</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="blocked" className="size-4" />Área interditada</span>
        <span className="inline-flex items-center gap-2"><ResourceSwatch visual="blocked" className="size-4" />Equipamento quebrado</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="font-medium text-t3">Severidade</span>
        <span className="inline-flex items-center gap-2"><SeverityGlyph nivel="critical" />Crítico</span>
        <span className="inline-flex items-center gap-2"><SeverityGlyph nivel="attention" />Atenção</span>
        <span className="text-xs text-t3">· não indica estado do recurso</span>
      </div>
    </div>
  );
}
