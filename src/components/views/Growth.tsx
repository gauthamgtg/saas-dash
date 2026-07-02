'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, movementSeries } from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { CHART } from '@/src/lib/theme'

export function Growth() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const data = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }).map((s) => ({
      month: s.month, New: Math.round(s.newMrr), Expansion: Math.round(s.expansion),
      Reactivation: Math.round(s.reactivation), Contraction: -Math.round(s.contraction),
      Churn: -Math.round(s.churn), 'Net new': Math.round(s.netNew),
    }))
  }, [txs, state.controls])

  return (
    <div className="space-y-5">
      <ViewHeader index="02" kicker="Movement" title="Growth" sub="MRR bridge — expansion & reactivation up, contraction & churn down" />
      <BarsChart data={data} xKey="month" stacked series={[
        { key: 'New', color: CHART.pos }, { key: 'Expansion', color: '#2f9e6e' },
        { key: 'Reactivation', color: CHART.steel }, { key: 'Contraction', color: CHART.warn },
        { key: 'Churn', color: CHART.neg },
      ]} />
      <TrendChart data={data} xKey="month" series={[{ key: 'Net new', color: CHART.navy }]} />
    </div>
  )
}
