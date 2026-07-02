export function ViewHeader({ index, kicker, title, sub }: {
  index: string; kicker: string; title: string; sub?: string
}) {
  return (
    <header className="flex items-baseline gap-4 border-b border-line-strong pb-3">
      <span className="font-mono text-5xl font-light leading-none text-ink-faint tabular-nums">{index}</span>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-soft">{kicker}</div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
      </div>
    </header>
  )
}
