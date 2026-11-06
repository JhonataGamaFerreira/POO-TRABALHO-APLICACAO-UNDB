import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NivelVisual } from "@/lib/terminal";
import {
  ResourceSwatch,
  ResourceTag,
  SeverityIndicator,
  type VisualRecurso,
} from "./indicators";

const estiloVisual: Record<VisualRecurso, string> = {
  free: "border-[1.5px] border-line-brand bg-surface",
  occupied: "border border-line-resource bg-occupied",
  maintenance: "hatch-maintenance border border-line-pattern",
  blocked: "hatch-blocked border border-blocked-line/60",
};

const base =
  "relative flex min-w-0 flex-col rounded-ds-lg text-left transition-opacity";
const selecao = "ring-[2.5px] ring-line-brand ring-offset-1";

function Marcador({ visual }: { visual: VisualRecurso }) {
  if (visual === "occupied")
    return <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-line-brand" />;
  if (visual === "free")
    return (
      <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-line-brand" />
    );
  return null;
}

interface Comum {
  href: string;
  selecionado?: boolean;
  /** Fora do filtro ativo: fica atenuado, não some. */
  atenuado?: boolean;
  /** Elemento afetado pela ocorrência em foco. */
  afetado?: boolean;
  codigo: string;
  visual: VisualRecurso;
  /** Texto do estado do recurso, vindo do backend. */
  rotuloEstado: string;
}

/** Dock Cell (DS 09.10): doca com o caminhão associado, quando houver. */
export function DockCell({
  href,
  selecionado,
  atenuado,
  afetado,
  codigo,
  visual,
  rotuloEstado,
  placa,
  operacao,
  duracao,
  equipamento,
}: Comum & {
  placa?: string;
  operacao?: string;
  duracao?: string;
  equipamento?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      aria-label={`Doca ${codigo}: ${rotuloEstado}${placa ? `, ${placa}` : ""}`}
      className={cn(
        base,
        "min-h-[149px] gap-1 p-2.5",
        estiloVisual[visual],
        (selecionado || afetado) && selecao,
        atenuado && "opacity-40",
      )}
    >
      {afetado && (
        <Badge variant="brand" className="absolute -top-2.5 left-2">
          afetado
        </Badge>
      )}
      <span className="flex items-center justify-between">
        <span className="text-sm font-semibold text-t1">{codigo}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
        {visual === "blocked" && <ResourceTag tone="blocked">Interd.</ResourceTag>}
        <Marcador visual={visual} />
      </span>
      {placa ? (
        <>
          <span className="font-mono text-[13px] font-medium text-t1">{placa}</span>
          <span className="text-[13px] text-t1">{operacao}</span>
          <span className="font-mono text-[13px] text-t2">{duracao}</span>
          <span className="mt-auto font-mono text-[13px] text-t3">
            {equipamento ?? "sem equipamento"}
          </span>
        </>
      ) : (
        <span className="text-[13px] text-t1">{rotuloEstado}</span>
      )}
    </Link>
  );
}

/** Yard Slot (DS 09.10): vaga do pátio. */
export function YardSlot({
  href,
  selecionado,
  atenuado,
  afetado,
  codigo,
  visual,
  rotuloEstado,
  placa,
  situacao,
  detalhe,
  espera,
  nivel = "none",
  rotuloSeveridade,
}: Comum & {
  placa?: string;
  /** Etapa da operação (estado da operação, não do recurso). */
  situacao?: string;
  detalhe?: string;
  espera?: string;
  nivel?: NivelVisual;
  rotuloSeveridade?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      aria-label={`Vaga ${codigo}: ${rotuloEstado}${placa ? `, ${placa}` : ""}`}
      className={cn(
        base,
        "min-h-[108px] gap-0.5 p-2.5",
        estiloVisual[visual],
        (selecionado || afetado) && selecao,
        atenuado && "opacity-40",
      )}
    >
      {afetado && (
        <Badge variant="brand" className="absolute -top-2.5 left-2">
          afetado
        </Badge>
      )}
      <span className="flex items-center justify-between">
        <span className="text-sm font-semibold text-t1">{codigo}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
        {visual === "blocked" && <ResourceTag tone="blocked">Interd.</ResourceTag>}
        <Marcador visual={visual} />
      </span>
      {placa ? (
        <>
          <span className="font-mono text-sm font-medium text-t1">{placa}</span>
          <span className="text-[13px] text-t2">{situacao}</span>
          <span className="mt-auto flex items-end justify-between gap-1 text-[13px] text-t3">
            <span className="truncate">{detalhe}</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-sm font-medium text-t1">{espera}</span>
              {nivel !== "none" && (
                <SeverityIndicator
                  nivel={nivel}
                  rotulo={rotuloSeveridade ?? ""}
                  mostrarRotulo={false}
                />
              )}
            </span>
          </span>
        </>
      ) : (
        <span className="text-[13px] text-t1">{rotuloEstado}</span>
      )}
    </Link>
  );
}

/** Equipment Card (DS 09.10): equipamento e seu estado informado pelo backend. */
export function EquipmentCard({
  href,
  selecionado,
  atenuado,
  afetado,
  nome,
  visual,
  rotuloEstado,
  alerta,
}: {
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  afetado?: boolean;
  nome: string;
  visual: VisualRecurso;
  rotuloEstado: string;
  /** Ocorrência aberta ligada ao equipamento (texto real do tipo). */
  alerta?: { nivel: NivelVisual; rotuloSeveridade: string; texto: string };
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        base,
        "min-h-[58px] justify-center gap-0.5 px-3 py-2",
        estiloVisual[visual],
        (selecionado || afetado) && selecao,
        atenuado && "opacity-40",
      )}
    >
      {afetado && (
        <Badge variant="brand" className="absolute -top-2.5 left-2">
          afetado
        </Badge>
      )}
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium text-t1">{nome}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
      </span>
      <span className="text-[13px] text-t2">{rotuloEstado}</span>
      {alerta && (
        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-ds-sm bg-surface px-1 text-xs text-t1">
          <SeverityIndicator nivel={alerta.nivel} rotulo={alerta.rotuloSeveridade} mostrarRotulo={false} />
          {alerta.texto}
        </span>
      )}
    </Link>
  );
}

/** Resource Chip (DS 09.10): atalho compacto para um recurso que pede atenção. */
export function ResourceChip({
  href,
  selecionado,
  visual,
  codigo,
  rotulo,
}: {
  href: string;
  selecionado?: boolean;
  visual: VisualRecurso;
  codigo: string;
  rotulo: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full bg-surface px-2.5 text-sm hover:bg-canvas",
        selecionado ? "border-2 border-line-brand" : "border border-line",
      )}
    >
      <ResourceSwatch visual={visual} className="size-4" />
      <span className="font-mono font-medium text-t1">{codigo}</span>
      <span className="text-t2">{rotulo}</span>
    </Link>
  );
}
