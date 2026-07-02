'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, movementSeries, quickRatio, cmgr, nrr, grr, momGrowth } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { CHART } from '@/src/lib/theme'
import { fmtPct } from '@/src/lib/format'

export function Growth() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls])

  const data = series.map((s) => ({
    month: s.month, New: Math.round(s.newMrr), Expansion: Math.round(s.expansion),
    Reactivation: Math.round(s.reactivation), Contraction: -Math.round(s.contraction),
    Churn: -Math.round(s.churn), 'Net new': Math.round(s.netNew),
  }))

  const kpis = useMemo(() => {
    const last = m.months[m.months.length - 1] ?? ''
    const prev = addMonths(last, -1)
    return { quick: quickRatio(series), cmgr: cmgr(m), mom: momGrowth(m, last), nrr: nrr(m, prev, last), grr: grr(m, prev, last) }
  }, [m, series])

  return (
    <div className="space-y-5">
      <ViewHeader index="02" kicker="Movement" title="Growth" sub="MRR bridge — expansion & reactivation up, contraction & churn down" />
      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-5 [&>*]:border-0">
        <KpiCard label="Quick ratio" value={kpis.quick == null ? '—' : kpis.quick.toFixed(2)} />
        <KpiCard label="CMGR" value={fmtPct(kpis.cmgr)} hint="compound monthly" />
        <KpiCard label="MoM growth" value={fmtPct(kpis.mom)} tone={kpis.mom != null && kpis.mom < 0 ? 'neg' : 'pos'} />
        <KpiCard label="NRR (MoM)" value={fmtPct(kpis.nrr)} />
        <KpiCard label="GRR (MoM)" value={fmtPct(kpis.grr)} />
      </div>
      <BarsChart data={data} xKey="month" stacked series={[
        { key: 'New', color: CHART.pos }, { key: 'Expansion', color: '#2f9e6e' },
        { key: 'Reactivation', color: CHART.steel }, { key: 'Contraction', color: CHART.warn },
        { key: 'Churn', color: CHART.neg },
      ]} />
      <TrendChart data={data} xKey="month" series={[{ key: 'Net new', color: CHART.navy }]} />
    </div>
  )
}
