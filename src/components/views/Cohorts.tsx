'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, cohorts, realizedLtvByCohort, firstPurchaseToRepeat, timeToSecondPurchaseDays, initialDealSizes, median } from '@/src/lib/engine'
import { Heatmap } from '@/src/components/ui/Heatmap'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Panel } from '@/src/components/ui/Panel'
import { Callout } from '@/src/components/ui/Callout'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:border-0'
const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length

export function Cohorts() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const cs = useMemo(() => cohorts(buildMatrix(txs, state.controls.mode)), [txs, state.controls])

  const net = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.netRetention }))
  const logo = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.logoSurvival }))

  const curve = useMemo(() => {
    const maxAge = Math.max(0, ...cs.map((c) => c.netRetention.length))
    return Array.from({ length: maxAge }, (_, age) => {
      const nrs = cs.map((c) => c.netRetention[age]).filter((v): v is number => v != null)
      const ls = cs.map((c) => c.logoSurvival[age]).filter((v): v is number => v != null)
      return {
        age: `M${age}`,
        'Net revenue': nrs.length ? +(avg(nrs) * 100).toFixed(1) : null,
        'Logo survival': ls.length ? +(avg(ls) * 100).toFixed(1) : null,
      }
    })
  }, [cs])

  const ltv = useMemo(() => realizedLtvByCohort(buildMatrix(txs, state.controls.mode)), [txs, state.controls])
  const dealMedian = useMemo(() => median(initialDealSizes(txs)), [txs])

  const ltvCols: Column<(typeof ltv)[number]>[] = [
    { key: 'cohort', header: 'Cohort', render: (r) => r.cohortMonth },
    { key: 'size', header: 'Size', align: 'right', render: (r) => fmtNum(r.size) },
    { key: 'ltv', header: 'Realized LTV / customer', align: 'right', render: (r) => fmtMoney(r.cumAvg[r.cumAvg.length - 1] ?? 0) },
    { key: 'ages', header: 'Months observed', align: 'right', render: (r) => r.cumAvg.length },
  ]

  return (
    <div className="space-y-4">
      <ViewHeader index="04" kicker="Retention" title="Cohorts" sub="Grouped by acquisition month, tracked by age" />

      <div className={KSTRIP}>
        <KpiCard label="First→repeat conversion" value={fmtPct(firstPurchaseToRepeat(txs))} hint="≥2 payments" />
        <KpiCard label="Median time to 2nd" value={timeToSecondPurchaseDays(txs) == null ? '—' : `${Math.round(timeToSecondPurchaseDays(txs)!)}d`} />
        <KpiCard label="Median initial deal" value={fmtMoney(dealMedian)} hint="first payment" />
      </div>

      <Panel title="Retention curves" sub="all-cohort average by age (M0 = acquisition)">
        <TrendChart data={curve} xKey="age" height={260} showLegend
          refLines={[{ y: 100, label: '100%', color: 'var(--ink-faint)' }]}
          series={[{ key: 'Net revenue', color: CHART.accent }, { key: 'Logo survival', color: CHART.steel }]} />
      </Panel>

      <Panel title="Net revenue retention" sub="cohort revenue at age Mₙ ÷ month-0 revenue · >100% = expansion">
        <Heatmap rows={net} />
      </Panel>
      <Panel title="Logo survival" sub="share of the cohort still active at each age">
        <Heatmap rows={logo} />
      </Panel>
      <Panel title="Realized LTV by cohort">
        <DataTable columns={ltvCols} rows={ltv} />
      </Panel>
      <Callout>Realized (observed) cumulative revenue per customer — no churn-model assumptions. Apply a gross-margin factor for margin-LTV.</Callout>
    </div>
  )
}
