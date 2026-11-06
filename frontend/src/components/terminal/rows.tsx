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
        "relative flex flex-col items-start gap-2 border-b border-line px-5 py-4 transition-colors last:border-b-0 sm:flex-row sm:items-center sm:gap-6",
        "hover:bg-canvas active:bg-selected",
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
  linha2,
  linha3,
  etiquetas,
  espera,
  nivel = "none",
  rotuloSeveridade,
  pontos,
  marca,
}: {
  href: string;
  selecionado: boolean;
  /** Posição na fila. */
  posicao: number;
  placa: string;
  /** Segunda linha: tipo de carga ou descrição. */
  linha2: string;
  /** Terceira linha: etapa ou motivo da espera. */
  linha3: string;
  /** Características da carga exibidas como etiquetas. */
  etiquetas?: string[];
  espera: string;
  nivel?: NivelVisual;
  rotuloSeveridade?: string;
  /** Pontuação da fila já formatada, ex.: "206 pts" . */
  pontos?: string;
  /** Etiqueta de contexto, ex.: "afetado". */
  marca?: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selecionado ? "true" : undefined}
      className={cn(
        "relative flex items-start gap-3 border-b border-line py-3 pr-3 pl-4 transition-colors last:border-b-0",
        "hover:bg-canvas active:bg-selected",
        selecionado && ["bg-selected hover:bg-selected", barraSelecao],
      )}
    >
      <span className="w-4 shrink-0 pt-0.5 font-mono text-xs text-t3">{posicao}</span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-t1">{placa}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-t2">
          {linha2}
          {etiquetas?.map((e) => (
            <Badge key={e} variant="brand">
              {e}
            </Badge>
          ))}
        </p>
        <p className="text-[13px] text-t3">{linha3}</p>
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
        {pontos && (
          <span className="font-mono text-xs text-t3" title="Pontuação de prioridade">
            {pontos}
          </span>
        )}
        {marca && <Badge variant="brand">{marca}</Badge>}
      </div>
    </Link>
  );
}

/** Entry Row (DS 09.10): linha compacta de pré-entrada e fila externa. */
export function EntryRow({
  placa,
  detalhe,
  tempo,
  atencao,
  href,
}: {
  placa: string;
  detalhe?: string;
  /** Tempo na etapa, já formatado. */
  tempo?: string;
  atencao?: boolean;
  href?: string;
}) {
  const conteudo = (
    <>
      <span className="flex w-[11px] justify-center">
        {atencao ? <SeverityGlyph nivel="attention" /> : null}
      </span>
      <span className="font-mono text-[13px] font-medium text-t1">{placa}</span>
      {detalhe && <span className="text-[13px] text-t2">{detalhe}</span>}
      {tempo && <span className="ml-auto font-mono text-[13px] text-t3">{tempo}</span>}
      {atencao && <span className="sr-only">Com ocorrência aberta</span>}
    </>
  );
  const classe = "flex items-center gap-3 rounded-ds-sm px-1 py-1";
  return href ? (
    <Link
      href={href}
      scroll={false}
      className={cn(classe, "transition-colors hover:bg-canvas active:bg-selected")}
    >
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
  faixa = "normal",
  afetados,
  notas,
}: {
  indice: number;
  nome: string;
  quantidade: number;
  /** Média por etapa informada pelo backend, já formatada; omitida se ausente. */
  media?: string;
  /** Faixa de espera definida pelo sistema (PROPOSTA); "normal" não destaca. */
  faixa?: "normal" | "atencao" | "critica";
  /** Operações da etapa ligadas à ocorrência selecionada. */
  afetados?: number;
  /** Linhas de rodapé quando não há média (ex.: Finalizado: "hoje", "fora dos 15"). */
  notas?: string[];
}) {
  const selecionada = !!afetados;
  const destaque = faixa !== "normal";
  return (
    <div
      className={cn(
        // As linhas entre etapas vêm do contêiner (gap-px); a borda aqui só marca destaque/seleção.
        "relative flex min-h-[150px] min-w-0 flex-col gap-1 border border-transparent bg-surface p-2.5",
        destaque && "border-t-[3px] border-t-attention bg-sev-attention-bg",
        selecionada && "z-10 border-2 border-line-brand",
      )}
    >
      {selecionada && (
        <Badge variant="brand" className="absolute -top-3 left-2 z-20">
          {afetados} {afetados === 1 ? "afetado" : "afetados"}
        </Badge>
      )}
      <span className="font-mono text-xs text-t3">{indice}</span>
      <span className="min-h-[34px] text-[13px] leading-tight font-medium text-t1">{nome}</span>
      <span className="mt-auto font-mono text-2xl font-medium text-t1">{quantidade}</span>
      {media ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            destaque ? "font-semibold text-attention-strong" : "text-t3",
          )}
        >
          {destaque && <SeverityGlyph nivel="attention" />}
          média {media}
          {destaque && <span className="sr-only"> (acima da faixa de espera)</span>}
        </span>
      ) : (
        (notas ?? ["sem média"]).map((n) => (
          <span key={n} className="text-xs text-t3">
            {n}
          </span>
        ))
      )}
    </div>
  );
}
