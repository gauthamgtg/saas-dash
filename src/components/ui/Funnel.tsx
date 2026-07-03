import { CHART } from '@/src/lib/theme'
import { fmtNum, fmtPct } from '@/src/lib/format'
import type { FunnelStep } from '@/src/lib/engine/funnel'

/** Stepped activation funnel: left-aligned bars sized by share of the top step, with drop-off between steps. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const top = steps[0]?.count || 1
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null
        const drop = prev && prev > 0 ? 1 - s.count / prev : null
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink">{s.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-ink-soft">{fmtNum(s.count)} · {fmtPct(s.pct, 0)}</span>
            </div>
            <div className="relative h-6 overflow-hidden rounded-md bg-paper-2">
              <div className="flex h-full items-center rounded-md pl-2" style={{ width: `${Math.max(4, (s.count / top) * 100)}%`, background: CHART.series[i % CHART.series.length], opacity: 0.85 }} />
              {drop != null && drop > 0.001 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] tabular-nums text-neg">−{fmtPct(drop, 0)} drop</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
