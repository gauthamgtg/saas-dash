'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, movementSeries } from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'

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
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Growth — MRR movement</h1>
      <BarsChart data={data} xKey="month" stacked series={[
        { key: 'New', color: '#22c55e' }, { key: 'Expansion', color: '#16a34a' },
        { key: 'Reactivation', color: '#84cc16' }, { key: 'Contraction', color: '#f59e0b' },
        { key: 'Churn', color: '#ef4444' },
      ]} />
      <TrendChart data={data} xKey="month" series={[{ key: 'Net new', color: '#4f46e5' }]} />
    </div>
  )
}
