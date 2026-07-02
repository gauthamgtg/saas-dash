export function ViewHeader({ index, kicker, title, sub, actions }: {
  index: string; kicker: string; title: string; sub?: string; actions?: React.ReactNode
}) {
  return (
    <header className="flex items-end justify-between gap-4 border-b border-line-strong pb-4">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-5xl font-light leading-none tabular-nums text-ink-faint">{index}</span>
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">
            <span className="inline-block h-1 w-1 rounded-full bg-accent" />{kicker}
          </div>
          <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {sub && <p className="mt-0.5 text-sm text-ink-soft">{sub}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}
