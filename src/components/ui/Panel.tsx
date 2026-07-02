/** Standard card: title row (with optional right-hand control) + body. Matches the reference cards. */
export function Panel({ title, sub, right, children, className = '', bodyClass = '' }: {
  title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string
}) {
  return (
    <section className={`rounded-xl border border-line bg-paper p-4 shadow-card ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">{title}</h3>}
            {sub && <p className="mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}
