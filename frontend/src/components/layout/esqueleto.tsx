/** Estado de carregamento exibido até o terminal ser lido do armazenamento do navegador. */
export function EsqueletoPagina() {
  return (
    <div className="flex" role="status" aria-live="polite" aria-busy="true">
      <main className="flex min-w-0 flex-1 flex-col gap-8 p-6">
        <div className="h-8 w-48 animate-pulse rounded-ds-md bg-line" />
        <div className="h-44 animate-pulse rounded-ds-lg border border-line bg-surface" />
        <div className="h-28 animate-pulse rounded-ds-lg border border-line bg-surface" />
        <div className="h-64 animate-pulse rounded-ds-lg border border-line bg-surface" />
        <span className="sr-only">Carregando…</span>
      </main>
    </div>
  );
}
