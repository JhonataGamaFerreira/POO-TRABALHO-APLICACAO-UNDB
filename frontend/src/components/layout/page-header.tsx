export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-t1">{titulo}</h1>
        {descricao && <p className="text-sm text-t2">{descricao}</p>}
      </div>
      {acoes}
    </header>
  );
}

/** Cartão de seção com título (usa os tokens de superfície do DS). */
export function Secao({
  titulo,
  contagem,
  nota,
  children,
  className = "",
}: {
  titulo: string;
  contagem?: string;
  nota?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-ds-lg border border-line bg-surface ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-t1">{titulo}</h2>
        {contagem && <span className="text-sm text-t2">{contagem}</span>}
      </div>
      {nota && <p className="px-5 pt-2 text-xs text-t3">{nota}</p>}
      {children}
    </section>
  );
}
