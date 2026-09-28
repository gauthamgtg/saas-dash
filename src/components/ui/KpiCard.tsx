import { Delta } from './Delta'
import { Sparkline } from './Sparkline'

const tint = (c: string) => `color-mix(in srgb, ${c} 13%, transparent)`

/**
 * KPI stat card. `hero` = standalone bordered card (reference style: round icon chip,
 * big value, delta + "vs period" line). Non-hero = compact cell for gap-px strip grids.
 */
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
  const ic = iconColor ?? 'var(--accent)'

  if (hero) {
    return (
      <div className="group relative rounded-2xl border border-line bg-paper p-4 shadow-card transition-shadow duration-200 hover:shadow-pop">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px]" style={{ color: ic, background: tint(ic) }}>{icon}</span>
          )}
          <span title={hint} className="min-w-0 truncate text-[12.5px] font-medium leading-snug text-ink-soft">{label}</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-1.5">
          <div title={value} className={`min-w-0 truncate text-[clamp(1.4rem,1.75vw,1.9rem)] font-semibold leading-none tabular-nums tracking-[-0.03em] ${color}`}>{value}</div>
          {spark && spark.length > 1 && (
            <Sparkline data={spark} color={sparkColor ?? (tone === 'neg' ? 'var(--neg)' : 'var(--accent)')} w={60} h={26} />
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {delta !== undefined && <Delta value={delta ?? null} invert={deltaInvert} />}
          {(deltaLabel || hint) && <span className="truncate text-[11.5px] leading-snug text-ink-faint">{deltaLabel ?? hint}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="group relative bg-paper p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px]" style={{ color: ic, background: tint(ic) }}>{icon}</span>
          )}
          <div className="text-[12.5px] font-medium text-ink-soft">{label}</div>
        </div>
        {delta !== undefined && <span className="shrink-0"><Delta value={delta ?? null} invert={deltaInvert} /></span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-1.5">
        <div title={value} className={`min-w-0 truncate text-[1.6rem] font-semibold leading-tight tabular-nums tracking-[-0.03em] ${color}`}>{value}</div>
        {spark && spark.length > 1 && (
          <Sparkline data={spark} color={sparkColor ?? (tone === 'neg' ? 'var(--neg)' : 'var(--accent)')} w={72} h={24} />
        )}
      </div>
      {(hint || deltaLabel) && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">{deltaLabel ?? hint}</div>}
    </div>
  )
}
