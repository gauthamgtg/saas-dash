import { fmtPct } from '@/src/lib/format'

/** MoM delta chip. `value` is a fraction (0.12 = +12%). Higher-is-better by default. */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) return null
  const flat = Math.abs(value) < 0.0005
  const good = invert ? value < 0 : value > 0
  const tone = flat ? 'text-ink-soft' : good ? 'text-pos' : 'text-neg'
  const arrow = flat ? '→' : value > 0 ? '▲' : '▼'
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums ${tone}`}>
      <span className="text-[9px] leading-none">{arrow}</span>
      {fmtPct(Math.abs(value))}
    </span>
  )
}
