export function KpiCard({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'pos' | 'neg' | 'default'
}) {
  const color = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'
  return (
    <div className="border border-line bg-paper p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-medium tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-1 text-[11px] leading-snug text-ink-faint">{hint}</div>}
    </div>
  )
}
