import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

const tint = (c: string) => `color-mix(in srgb, ${c} 15%, transparent)`

export function KpiCard({ label, value, hint, tone, delta, deltaLabel, deltaInvert, spark, sparkColor, hero, icon, iconColor }: {
  label: string
  value: string
  hint?: string
  tone?: 'pos' | 'neg' | 'default'
  delta?: number | null
  deltaLabel?: string
  deltaInvert?: boolean
  spark?: number[]
  sparkColor?: string
  hero?: boolean
  icon?: string
  iconColor?: string
}) {
  const color = tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink'
  const surface = hero
    ? 'rounded-xl border border-line bg-paper p-5 shadow-card'
    : 'bg-paper p-4'
  const ic = iconColor ?? 'var(--accent)'
  return (
    <div className={`group relative ${surface}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px]" style={{ color: ic, background: tint(ic) }}>{icon}</span>
          )}
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">{label}</div>
        </div>
        {delta !== undefined && <Delta value={delta ?? null} invert={deltaInvert} />}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={`font-mono tabular-nums ${hero ? 'text-[1.9rem] leading-none' : 'text-2xl'} font-semibold ${color}`}>{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? (tone === 'neg' ? 'var(--neg)' : 'var(--accent)')} w={hero ? 100 : 80} h={hero ? 32 : 26} />
        )}
      </div>
      {(hint || deltaLabel) && <div className="mt-1.5 text-[11px] leading-snug text-ink-faint">{deltaLabel ?? hint}</div>}
    </div>
  )
}
