/** Page title block. `index` is kept on the API for call-site compatibility but no longer rendered. */
export function ViewHeader({ kicker, title, sub, actions }: {
  index?: string; kicker: string; title: string; sub?: string; actions?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-accent">{kicker}</div>
        <h1 className="mt-1 text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-[14px] text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}
