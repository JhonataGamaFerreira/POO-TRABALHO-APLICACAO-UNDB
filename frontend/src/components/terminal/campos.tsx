"use client";

import { TriangleAlert } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Campos de formulário do terminal, com os tokens do DS (Text Field: Default,
 * Focus, Error, Disabled). Rótulo sempre visível, mensagem de erro em texto e
 * ícone (nunca só a cor), ligados ao campo por aria-describedby.
 */
const controle =
  "w-full rounded-ds-lg border bg-surface px-3 text-sm text-t1 placeholder:text-t3 disabled:cursor-not-allowed disabled:opacity-50";
const borda = (erro?: string) => (erro ? "border-critical" : "border-line-resource");

export function Erro({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs text-critical">
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function Rotulo({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-t1">
      {children}
    </label>
  );
}

interface BaseProps {
  rotulo: string;
  erro?: string;
  dica?: React.ReactNode;
}

export function CampoTexto({
  rotulo,
  erro,
  dica,
  className,
  ...props
}: BaseProps & Omit<React.ComponentProps<"input">, "id">) {
  const id = useId();
  const descricao = [erro ? `${id}-erro` : null, dica ? `${id}-dica` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={cn(controle, "h-10", borda(erro), className)}
        {...props}
      />
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-xs text-t3">
          {dica}
        </p>
      )}
      {erro && <Erro id={`${id}-erro`}>{erro}</Erro>}
    </div>
  );
}

export function CampoAreaTexto({
  rotulo,
  erro,
  dica,
  className,
  ...props
}: BaseProps & Omit<React.ComponentProps<"textarea">, "id">) {
  const id = useId();
  const descricao = [erro ? `${id}-erro` : null, dica ? `${id}-dica` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <textarea
        id={id}
        rows={3}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={cn(controle, "min-h-20 resize-y py-2", borda(erro), className)}
        {...props}
      />
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-xs text-t3">
          {dica}
        </p>
      )}
      {erro && <Erro id={`${id}-erro`}>{erro}</Erro>}
    </div>
  );
}

export interface OpcaoSelecao {
  valor: string;
  rotulo: string;
  desabilitada?: boolean;
}

export function CampoSelecao({
  rotulo,
  erro,
  dica,
  opcoes,
  className,
  ...props
}: BaseProps & { opcoes: OpcaoSelecao[] } & Omit<React.ComponentProps<"select">, "id" | "children">) {
  const id = useId();
  const descricao = [erro ? `${id}-erro` : null, dica ? `${id}-dica` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Rotulo htmlFor={id}>{rotulo}</Rotulo>
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao}
        className={cn(controle, "h-10", borda(erro), className)}
        {...props}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-xs text-t3">
          {dica}
        </p>
      )}
      {erro && <Erro id={`${id}-erro`}>{erro}</Erro>}
    </div>
  );
}

/**
 * Grupo de escolhas (radio ou caixa de seleção) em fieldset, com a opção
 * marcada destacada por borda e fundo (e pelo próprio controle nativo).
 */
export function GrupoEscolha({
  legenda,
  erro,
  children,
  className,
}: {
  legenda: string;
  erro?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <fieldset
      aria-invalid={erro ? true : undefined}
      aria-describedby={erro ? `${id}-erro` : undefined}
      className="flex min-w-0 flex-col gap-1.5"
    >
      <legend className="mb-1.5 text-sm font-medium text-t1">{legenda}</legend>
      <div className={cn("flex flex-col gap-2", className)}>{children}</div>
      {erro && <Erro id={`${id}-erro`}>{erro}</Erro>}
    </fieldset>
  );
}

export function Escolha({
  tipo,
  rotulo,
  descricao,
  lateral,
  className,
  ...props
}: {
  tipo: "radio" | "checkbox";
  rotulo: string;
  descricao?: string;
  /** Texto à direita (ex.: pontos que a característica soma na fila). */
  lateral?: React.ReactNode;
} & Omit<React.ComponentProps<"input">, "type" | "className"> & { className?: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-ds-lg border border-line-resource bg-surface px-3 py-2.5 text-sm transition-colors hover:bg-canvas has-[:checked]:border-line-brand has-[:checked]:bg-selected has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus-ring)]",
        className,
      )}
    >
      <input type={tipo} className="mt-0.5 size-4 shrink-0 accent-[var(--text-primary)]" {...props} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium text-t1">{rotulo}</span>
        {descricao && <span className="text-xs text-t2">{descricao}</span>}
      </span>
      {lateral && <span className="shrink-0 font-mono text-xs text-t3">{lateral}</span>}
    </label>
  );
}
