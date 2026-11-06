import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { NivelVisual } from "@/lib/terminal";
import { SeverityGlyph, SeverityIndicator } from "./indicators";

const barraSelecao =
  "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-line-brand before:content-['']";

/** Occurrence Row (DS 09.10): linha da lista "Atenção agora". */
export function OccurrenceRow({
  href,
  selecionado,
  numero,
  nivel,
  rotuloSeveridade,
  titulo,
  descricao,
  metrica,
  legenda,
}: {
  href: string;
  selecionado: boolean;
  numero: number;
  nivel: NivelVisual;
  rotuloSeveridade: string;
  titulo: string;
  descricao: string;
  metrica: string;
  legenda: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        "relative flex flex-col items-start gap-2 border-b border-line px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-6",
        "hover:bg-canvas",
        selecionado && ["bg-selected hover:bg-selected", barraSelecao],
      )}
    >
      <div className="flex shrink-0 flex-row items-center gap-3 sm:w-[110px] sm:flex-col sm:items-start sm:gap-2">
        <SeverityIndicator nivel={nivel} rotulo={rotuloSeveridade} />
        <span className="text-xs text-t3">Ocorrência {numero}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-t1">{titulo}</p>
        <p className="text-sm text-t2">{descricao}</p>
      </div>
      <div className="flex shrink-0 flex-row items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0">
        <span className="font-mono text-xl font-medium text-t1">{metrica}</span>
        <span className="text-xs text-t3">{legenda}</span>
      </div>
      <ChevronRight className="size-5 shrink-0 text-brand" aria-hidden="true" />
    </Link>
  );
}

/** Truck Row (DS 09.10): linha de caminhão em lista de fila. */
export function TruckRow({
  href,
  selecionado,
  posicao,
  placa,
  carga,
  situacao,
  espera,
  nivel = "none",
  rotuloSeveridade,
  etiqueta,
  complemento,
}: {
  href: string;
  selecionado: boolean;
  posicao: number;
  placa: string;
  carga: string;
  situacao: string;
  espera: string;
  nivel?: NivelVisual;
  rotuloSeveridade?: string;
  etiqueta?: string;
  /** Texto extra à direita, ex.: pontuação informada pelo backend. */
  complemento?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        "relative flex items-start gap-3 border-b border-line py-3 pr-3 pl-4 last:border-b-0",
        "hover:bg-canvas",
        selecionado && ["bg-selected hover:bg-selected", barraSelecao],
      )}
    >
      <span className="w-4 shrink-0 pt-0.5 font-mono text-xs text-t3">{posicao}</span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-t1">{placa}</p>
        <p className="text-[13px] text-t2">{carga}</p>
        <p className="text-[13px] text-t3">{situacao}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="inline-flex items-center gap-2">
          {nivel !== "none" && (
            <SeverityIndicator
              nivel={nivel}
              rotulo={rotuloSeveridade ?? ""}
              mostrarRotulo={false}
            />
          )}
          <span className="font-mono text-base font-medium text-t1">{espera}</span>
        </span>
        {complemento && <span className="font-mono text-xs text-t3">{complemento}</span>}
        {etiqueta && <Badge variant="brand">{etiqueta}</Badge>}
      </div>
    </Link>
  );
}

/** Entry Row (DS 09.10): linha compacta de pré-entrada e fila externa. */
export function EntryRow({
  placa,
  detalhe,
  atencao,
  href,
}: {
  placa: string;
  detalhe: string;
  atencao?: boolean;
  href?: string;
}) {
  const conteudo = (
    <>
      <span className="flex w-[11px] justify-center">
        {atencao ? <SeverityGlyph nivel="attention" /> : null}
      </span>
      <span className="font-mono text-[13px] font-medium text-t1">{placa}</span>
      <span className="text-[13px] text-t2">{detalhe}</span>
      {atencao && <span className="sr-only">Com ocorrência aberta</span>}
    </>
  );
  const classe = "flex items-center gap-2 rounded-ds-sm py-1";
  return href ? (
    <Link href={href} scroll={false} className={cn(classe, "hover:bg-canvas")}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Flow Stage (DS 09.10): etapa do fluxo do terminal (estado da operação). */
export function FlowStage({
  indice,
  nome,
  quantidade,
  media,
  afetados,
  nota,
}: {
  indice: number;
  nome: string;
  quantidade: number;
  /** Média por etapa informada pelo backend, já formatada; omitida se ausente. */
  media?: string;
  /** Operações da etapa ligadas à ocorrência selecionada. */
  afetados?: number;
  nota?: string;
}) {
  const destacada = !!afetados;
  return (
    <div
      className={cn(
        "relative flex min-h-[152px] min-w-0 flex-col gap-1 border border-line bg-surface p-2.5",
        destacada && "z-10 border-2 border-line-brand bg-sev-attention-bg",
      )}
    >
      {destacada && (
        <Badge variant="brand" className="absolute -top-3 left-2">
          {afetados} {afetados === 1 ? "afetado" : "afetados"}
        </Badge>
      )}
      <span className="font-mono text-xs text-t3">{indice}</span>
      <span className="text-[13px] font-medium text-t1">{nome}</span>
      <span className="mt-auto font-mono text-2xl font-medium text-t1">{quantidade}</span>
      <span className="text-xs text-t3">{media ? `média ${media}` : (nota ?? "sem média")}</span>
    </div>
  );
}
