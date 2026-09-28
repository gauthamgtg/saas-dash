'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arr, activeCustomers, nrr, logoChurnRate, quickRatio, movementSeries } from '@/src/lib/engine'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'

/** Terminal-style stat strip under the control bar — the whole business at a glance, always on. */
export function Ticker() {
  const { state } = useApp()
  const stats = useMemo(() => {
    const txs = applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds)
    if (!txs.length) return []
    const m = buildMatrix(txs, state.controls.mode)
    const last = m.months[m.months.length - 1]
    const prev = m.months[m.months.length - 2]
    const mrr = mrrOf(m, last)
    const delta = prev ? (mrr - mrrOf(m, prev)) / (mrrOf(m, prev) || 1) : null
    const quick = quickRatio(movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }))
    return [
      { k: 'MRR', v: fmtMoney(mrr), d: delta },
      { k: 'ARR', v: fmtMoneyShort(arr(m, last)) },
      { k: 'NRR', v: prev ? fmtPct(nrr(m, prev, last)) : '—' },
      { k: 'Active', v: String(activeCustomers(m, last)) },
      { k: 'Churn', v: prev ? fmtPct(logoChurnRate(m, prev, last)) : '—' },
      { k: 'Quick ratio', v: quick == null ? '—' : quick.toFixed(2) },
    ]
  }, [state.transactions, state.filters, state.range, state.controls])

  if (!stats.length) return null
  return (
    <div className="no-print flex items-center gap-x-7 overflow-x-auto whitespace-nowrap border-b border-line bg-paper/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-8 py-2 text-[12px]">
      {stats.map((s) => (
        <span key={s.k} className="flex items-center gap-1.5">
          <span className="text-ink-faint">{s.k}</span>
          <span className="font-semibold tabular-nums text-ink">{s.v}</span>
          {s.d != null && Number.isFinite(s.d) && (
            <span className={`rounded px-1 text-[11px] font-medium tabular-nums ${s.d >= 0 ? 'text-pos' : 'text-neg'}`} style={{ background: `color-mix(in srgb, var(${s.d >= 0 ? '--pos' : '--neg'}) 10%, transparent)` }}>{s.d >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(s.d))}</span>
          )}
        </span>
      ))}
      <span className="ml-auto hidden items-center gap-1.5 text-ink-faint sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-pos" />Live · {state.controls.mode} MRR</span>
    </div>
  )
}
