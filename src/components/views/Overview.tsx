'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters, overviewModel } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arpa } from '@/src/lib/engine'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'

export function Overview() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const model = useMemo(() => overviewModel(txs, state.controls), [txs, state.controls])
  const trend = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)), ARPA: Math.round(arpa(m, mo) ?? 0) }))
  }, [txs, state.controls])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Overview — {model.month || 'no data'}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="MRR" value={fmtMoney(model.mrr)} />
        <KpiCard label="ARR" value={fmtMoney(model.arr)} />
        <KpiCard label="ARPA" value={fmtMoney(model.arpa)} />
        <KpiCard label="Active customers" value={fmtNum(model.activeCustomers)} />
        <KpiCard label="Logo churn (MoM)" value={fmtPct(model.logoChurn)} />
        <KpiCard label="Avg lifetime" value={model.avgLifetime == null ? '—' : `${model.avgLifetime.toFixed(1)} mo`} />
      </div>
      <TrendChart data={trend} xKey="month" series={[{ key: 'MRR', color: '#4f46e5' }, { key: 'ARPA', color: '#0891b2' }]} />
    </div>
  )
}
