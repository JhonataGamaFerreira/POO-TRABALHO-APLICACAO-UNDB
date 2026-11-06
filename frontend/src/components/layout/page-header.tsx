import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descricao,
  lateral,
}: {
  titulo: string;
  descricao?: string;
  /** Texto ou controles alinhados à direita do título (ex.: data de referência). */
  lateral?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold text-t1">{titulo}</h1>
        {descricao && <p className="text-sm text-t2">{descricao}</p>}
      </div>
      {lateral && <div className="text-sm text-t3">{lateral}</div>}
    </header>
  );
}

/**
 * Seção de página (DS 09.10): título em linha, contagem e nota à direita; o
 * conteúdo fica abaixo, em `Cartao` quando precisa de moldura.
 */
export function Secao({
  titulo,
  selo,
  contagem,
  nota,
  children,
  className,
}: {
  titulo: string;
  /** Contagem em destaque (ex.: "3 abertas"). */
  selo?: string;
  /** Contexto em texto simples (ex.: "17 caminhões ativos"). */
  contagem?: string;
  nota?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-semibold text-t1">{titulo}</h2>
          {selo && <Badge variant="critical">{selo}</Badge>}
          {contagem && <span className="text-sm text-t2">{contagem}</span>}
        </div>
        {nota && <div className="text-sm text-t3">{nota}</div>}
      </div>
      {children}
    </section>
  );
}

/** Superfície com moldura (borda e raio do DS). */
export function Cartao({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-ds-lg border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

/** Cabeçalho interno de um `Cartao`: título à esquerda e contagem à direita. */
export function CabecalhoCartao({ titulo, contagem }: { titulo: string; contagem?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
      <h2 className="text-base font-semibold text-t1">{titulo}</h2>
      {contagem && <span className="text-sm text-t2">{contagem}</span>}
    </div>
  );
}
