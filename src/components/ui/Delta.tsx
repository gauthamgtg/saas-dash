import { fmtPct } from '@/src/lib/format'

/** MoM delta chip. `value` is a fraction (0.12 = +12%). Higher-is-better by default. */
export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value == null || !Number.isFinite(value)) return null
  const flat = Math.abs(value) < 0.0005
  const good = invert ? value < 0 : value > 0
  const tone = flat ? 'text-ink-soft' : good ? 'text-pos' : 'text-neg'
  const arrow = flat ? '→' : value > 0 ? '↑' : '↓'
  const bg = flat ? 'var(--ink-faint)' : good ? 'var(--pos)' : 'var(--neg)'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-px text-[11.5px] font-semibold tabular-nums ${tone}`}
      style={{ background: `color-mix(in srgb, ${bg} 11%, transparent)` }}>
      <span className="leading-none">{arrow}</span>
      {fmtPct(Math.abs(value))}
    </span>
  )
}
