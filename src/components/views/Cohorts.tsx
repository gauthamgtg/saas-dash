'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, cohorts, realizedLtvByCohort, firstPurchaseToRepeat, timeToSecondPurchaseDays, initialDealSizes, median } from '@/src/lib/engine'
import { Heatmap } from '@/src/components/ui/Heatmap'
import { Callout } from '@/src/components/ui/Callout'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'

export function Cohorts() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const cs = useMemo(() => cohorts(buildMatrix(txs, state.controls.mode)), [txs, state.controls])

  const net = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.netRetention }))
  const logo = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.logoSurvival }))

  const ltv = useMemo(() => realizedLtvByCohort(buildMatrix(txs, state.controls.mode)), [txs, state.controls])
  const dealMedian = useMemo(() => median(initialDealSizes(txs)), [txs])

  const ltvCols: Column<(typeof ltv)[number]>[] = [
    { key: 'cohort', header: 'Cohort', render: (r) => r.cohortMonth },
    { key: 'size', header: 'Size', align: 'right', render: (r) => fmtNum(r.size) },
    { key: 'ltv', header: 'Realized LTV / customer', align: 'right', render: (r) => fmtMoney(r.cumAvg[r.cumAvg.length - 1] ?? 0) },
    { key: 'ages', header: 'Months observed', align: 'right', render: (r) => r.cumAvg.length },
  ]

  return (
    <div className="space-y-6">
      <ViewHeader index="04" kicker="Retention" title="Cohorts" sub="Grouped by acquisition month, tracked by age" />

      <div className="grid grid-cols-3 gap-px border border-line bg-line [&>*]:border-0">
        <KpiCard label="First→repeat conversion" value={fmtPct(firstPurchaseToRepeat(txs))} hint="≥2 payments" />
        <KpiCard label="Median time to 2nd" value={timeToSecondPurchaseDays(txs) == null ? '—' : `${Math.round(timeToSecondPurchaseDays(txs)!)}d`} />
        <KpiCard label="Median initial deal" value={fmtMoney(dealMedian)} hint="first payment" />
      </div>
      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Net revenue retention</h2>
        <Heatmap rows={net} />
        <Callout>Cell = cohort revenue at age M<sub>n</sub> ÷ its month-0 revenue. &gt;100% = net expansion.</Callout>
      </section>
      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Logo survival</h2>
        <Heatmap rows={logo} />
      </section>
      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Realized LTV by cohort</h2>
        <DataTable columns={ltvCols} rows={ltv} />
        <Callout>Realized (observed) cumulative revenue per customer — no churn-model assumptions. Truncated to each cohort&apos;s observed age; apply a gross-margin factor for margin-LTV.</Callout>
      </section>
    </div>
  )
}
