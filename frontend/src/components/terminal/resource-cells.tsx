import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NivelVisual } from "@/lib/terminal";
import {
  PauseGlyph,
  ResourceSwatch,
  ResourceTag,
  SeverityIndicator,
  estiloVisual,
  type VisualRecurso,
} from "./indicators";

const base =
  "relative flex min-w-0 flex-col rounded-ds-lg text-left transition-[opacity,box-shadow,transform] hover:ring-1 hover:ring-line-brand/60 active:translate-y-px";
const selecao = "ring-[2.5px] ring-line-brand ring-offset-1 hover:ring-[2.5px] hover:ring-line-brand";

function Marcador({ visual }: { visual: VisualRecurso }) {
  if (visual === "occupied")
    return <span aria-hidden="true" className="size-2.5 rounded-[2px] bg-line-brand" />;
  if (visual === "free")
    return (
      <span aria-hidden="true" className="size-2.5 rounded-full border-[1.5px] border-line-brand" />
    );
  if (visual === "interrupted") return <PauseGlyph />;
  return null;
}

/** Etiqueta sobre a borda superior da célula: "afetado", "consultando", "compatível · ocupada". */
function Marca({ marca }: { marca: { texto: string; tom?: "brand" | "dark" } }) {
  return (
    <Badge
      variant="brand"
      className={cn(
        "absolute -top-2.5 left-2 z-10",
        marca.tom === "dark" && "bg-line-strong",
      )}
    >
      {marca.texto}
    </Badge>
  );
}

interface Comum {
  href: string;
  selecionado?: boolean;
  /** Fora do filtro ativo: fica atenuado, não some. */
  atenuado?: boolean;
  /** Etiqueta de contexto (ex.: afetado pela ocorrência em foco). */
  marca?: { texto: string; tom?: "brand" | "dark" };
  codigo: string;
  visual: VisualRecurso;
  /** Texto do estado do recurso. */
  rotuloEstado: string;
}

export interface ProgressoOperacao {
  /** Minutos já operados. */
  operado: number;
  /** Duração prevista da operação. Sem ela, não há barra. */
  estimado: number | null;
}

/** Barra de progresso do tempo da operação; sem duração prevista, mostra só o tempo operado. */
function Progresso({ progresso, formatar }: { progresso: ProgressoOperacao; formatar: (m: number) => string }) {
  const { operado, estimado } = progresso;
  if (!estimado) {
    return <span className="font-mono text-[13px] text-t2">{formatar(operado)} em operação</span>;
  }
  const pct = Math.min(100, Math.round((operado / estimado) * 100));
  return (
    <>
      <span className="font-mono text-[13px] whitespace-nowrap text-t2">
        <span className="hidden @[90px]/dock:inline">{operado} de {estimado} min</span>
        <span className="@[90px]/dock:hidden">{operado}/{estimado} min</span>
      </span>
      <span
        role="progressbar"
        aria-label="Progresso da operação"
        aria-valuemin={0}
        aria-valuemax={estimado}
        aria-valuenow={Math.min(operado, estimado)}
        className="mt-1 block h-1 w-full rounded-full bg-line"
      >
        <span className="block h-full rounded-full bg-line-brand" style={{ width: `${pct}%` }} />
      </span>
    </>
  );
}

/** Dock Cell (DS 09.10): doca em cinco leituras visuais (livre, ocupada, interrompida, manutenção, bloqueada). */
export function DockCell({
  href,
  selecionado,
  atenuado,
  marca,
  codigo,
  visual,
  rotuloEstado,
  placa,
  operacao,
  progresso,
  formatar,
  equipamento,
  interrompidaHa,
  manutencaoAte,
  restricao,
  bloqueioMotivo,
}: Comum & {
  placa?: string;
  operacao?: string;
  progresso?: ProgressoOperacao;
  formatar: (minutos: number) => string;
  /** Mostra a linha do equipamento (telas de Pátio e docas). */
  equipamento?: string | null;
  /** "há 38 min" (visual interrompida). */
  interrompidaHa?: string;
  /** "16:30" (visual manutenção). */
  manutencaoAte?: string;
  /** Texto curto da restrição (doca livre sem equipamento compatível). */
  restricao?: string;
  bloqueioMotivo?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      aria-label={`Doca ${codigo}: ${rotuloEstado}${placa ? `, ${placa}` : ""}${restricao ? `, restrição: ${restricao}` : ""}`}
      className={cn(
        base,
        "@container/dock min-h-[112px] gap-1 p-2.5",
        estiloVisual[visual],
        selecionado && selecao,
        atenuado && "opacity-40",
      )}
    >
      {marca && <Marca marca={marca} />}
      <span className="flex items-center justify-between">
        <span className="text-sm font-semibold text-t1">{codigo}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
        {visual === "blocked" && <ResourceTag tone="blocked">Bloq.</ResourceTag>}
        <Marcador visual={visual} />
      </span>

      {(visual === "occupied" || visual === "interrupted") && placa && (
        <>
          <span className="font-mono text-[13px] font-medium text-t1">{placa}</span>
          <span className="text-[13px] text-t1">{operacao}</span>
          {progresso && <Progresso progresso={progresso} formatar={formatar} />}
          {visual === "interrupted" && (
            <span className="mt-1 text-[13px] leading-tight font-semibold text-attention-strong">
              Interrompida
              {interrompidaHa && (
                <span className="block font-mono font-normal">{interrompidaHa}</span>
              )}
            </span>
          )}
        </>
      )}

      {visual === "maintenance" && manutencaoAte && (
        <span className="mt-1 w-fit rounded-ds-sm bg-surface/90 px-1 font-mono text-[13px] text-t1">
          Até {manutencaoAte}
        </span>
      )}

      {visual === "blocked" && (
        <span className="mt-1 flex w-fit flex-col rounded-ds-sm bg-surface/90 px-1 text-[13px] text-critical">
          <strong>Bloqueada</strong>
          {bloqueioMotivo && <span className="text-t1">{bloqueioMotivo}</span>}
        </span>
      )}

      {visual === "free" && (
        <>
          <span className="text-[13px] text-t1">{rotuloEstado}</span>
          {restricao && (
            <span className="text-[13px] leading-tight text-attention-strong">
              <strong>! Restrição</strong>
              <span className="block">{restricao}</span>
            </span>
          )}
        </>
      )}

      {equipamento && (visual === "occupied" || visual === "interrupted") && (
        <span className="mt-auto pt-1 font-mono text-[13px] text-t3">{equipamento}</span>
      )}
    </Link>
  );
}

/** Yard Slot (DS 09.10): vaga do pátio. */
export function YardSlot({
  href,
  selecionado,
  atenuado,
  marca,
  codigo,
  visual,
  rotuloEstado,
  placa,
  situacao,
  detalhe,
  espera,
  nivel = "none",
  rotuloSeveridade,
  bloqueioMotivo,
}: Comum & {
  placa?: string;
  /** Etapa da operação (estado da operação, não do recurso). */
  situacao?: string;
  detalhe?: string;
  espera?: string;
  nivel?: NivelVisual;
  rotuloSeveridade?: string;
  bloqueioMotivo?: string;
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
        selecionado && selecao,
        atenuado && "opacity-40",
      )}
    >
      {marca && <Marca marca={marca} />}
      <span className="flex items-center justify-between">
        <span className="text-sm font-semibold text-t1">{codigo}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
        {visual === "blocked" && <ResourceTag tone="blocked">Bloq.</ResourceTag>}
        <Marcador visual={visual} />
      </span>

      {placa && (
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
      )}

      {!placa && visual === "blocked" && (
        <span className="mt-1 flex w-fit flex-col gap-0.5">
          <span className="w-fit rounded-ds-sm bg-surface/90 px-1 text-[13px] font-semibold text-critical">
            Bloqueada
          </span>
          {bloqueioMotivo && (
            <span className="w-fit rounded-ds-sm bg-surface/90 px-1 text-[13px] text-t1">
              {bloqueioMotivo}
            </span>
          )}
        </span>
      )}

      {!placa && visual !== "blocked" && (
        <span className="text-[13px] text-t1">{rotuloEstado}</span>
      )}
    </Link>
  );
}

/**
 * Equipment Card (DS 09.10): equipamento e seu estado.
 * Equipamento quebrado NÃO é um estado da API: aparece como `EM_MANUTENCAO`
 * mais uma ocorrência aberta de tipo EQUIPAMENTO_QUEBRADO; o marcador `alerta`
 * mostra essa ocorrência separadamente do estado do recurso.
 */
export function EquipmentCard({
  href,
  selecionado,
  atenuado,
  marca,
  nome,
  visual,
  rotuloEstado,
  alerta,
}: {
  href: string;
  selecionado?: boolean;
  atenuado?: boolean;
  marca?: { texto: string; tom?: "brand" | "dark" };
  nome: string;
  visual: VisualRecurso;
  rotuloEstado: string;
  /** Ocorrência aberta ligada ao equipamento. */
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
        selecionado && selecao,
        atenuado && "opacity-40",
      )}
    >
      {marca && <Marca marca={marca} />}
      <span className="flex items-center gap-2">
        <span className="font-mono text-sm font-medium text-t1">{nome}</span>
        {visual === "maintenance" && <ResourceTag tone="maintenance">Manut.</ResourceTag>}
      </span>
      <span className={cn("text-[13px] text-t2", visual === "blocked" && "w-fit rounded-ds-sm bg-surface/90 px-1")}>
        {rotuloEstado}
      </span>
      {alerta && (
        <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-ds-sm bg-surface px-1 text-xs font-medium text-t1">
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
        "inline-flex h-8 items-center gap-2 rounded-full bg-surface px-2.5 text-sm transition-colors hover:bg-canvas active:translate-y-px active:bg-selected",
        selecionado ? "border-2 border-line-brand" : "border border-line",
      )}
    >
      <ResourceSwatch visual={visual} className="size-4" />
      <span className="font-mono font-medium text-t1">{codigo}</span>
      <span className="text-t2">{rotulo}</span>
    </Link>
  );
}

/** Resource Mini (DS 09.10): vaga ou equipamento em tamanho compacto, com o código. */
export function ResourceMini({
  href,
  visual,
  texto,
  titulo,
  estado,
}: {
  href: string;
  visual: VisualRecurso;
  texto: string;
  /** Descrição completa (tooltip). */
  titulo: string;
  /** Estado em texto, lido por leitor de tela (cor não é o único canal). */
  estado: string;
}) {
  return (
    <Link
      href={href}
      title={`${titulo} · ${estado}`}
      className={cn(
        "inline-flex h-6 min-w-7 items-center justify-center rounded-ds-sm px-1.5 font-mono text-[11px] text-t1 transition-shadow hover:ring-1 hover:ring-line-brand/60 active:translate-y-px",
        estiloVisual[visual],
      )}
    >
      <span className={cn(visual === "blocked" || visual === "maintenance" ? "rounded-[2px] bg-surface/85 px-0.5" : "")}>
        {texto}
      </span>
      <span className="sr-only"> · {estado}</span>
    </Link>
  );
}
