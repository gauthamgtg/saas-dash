import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

export function KpiCard({ label, value, hint, tone, delta, deltaInvert, spark, sparkColor, hero }: {
  label: string
  value: string
  hint?: string
  tone?: 'pos' | 'neg' | 'default'
  delta?: number | null
  deltaInvert?: boolean
  spark?: number[]
  sparkColor?: string
  hero?: boolean
}) {
  const color = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'
  const surface = hero
    ? 'rounded-xl border border-line-strong bg-paper-2 p-5 shadow-card'
    : 'bg-paper p-4'
  return (
    <div className={`group relative ${surface}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</div>
        {delta !== undefined && <Delta value={delta ?? null} invert={deltaInvert} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={`font-mono tabular-nums ${hero ? 'text-[2rem] leading-none' : 'text-2xl'} font-medium ${color}`}>{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? (tone === 'neg' ? 'var(--neg)' : 'var(--accent)')} w={hero ? 108 : 84} h={hero ? 34 : 26} />
        )}
      </div>
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-ink-faint">{hint}</div>}
    </div>
  )
}
