'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, binAnalysis, binSeries } from '@/src/lib/engine'
import type { BinDef } from '@/src/lib/types'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'
import type { BinRow } from '@/src/lib/engine'

export function Bins() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const matrix = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])
  const [month, setMonth] = useState('')
  const activeMonth = month || matrix.months[matrix.months.length - 1] || ''

  const result = useMemo(() => (activeMonth ? binAnalysis(matrix, activeMonth, state.bins) : null), [matrix, activeMonth, state.bins])
  const trend = useMemo(() => binSeries(matrix, state.bins).map((r) => {
    const row: Record<string, any> = { month: r.month }
    r.bins.forEach((b) => { row[b.label] = Math.round(b.revenue) })
    return row
  }), [matrix, state.bins])

  function editBin(i: number, patch: Partial<BinDef>) {
    dispatch({ type: 'setBins', bins: state.bins.map((b, k) => (k === i ? { ...b, ...patch } : b)) })
  }
  function addBin() { dispatch({ type: 'setBins', bins: [...state.bins, { label: 'New bin', min: 0, max: null }] }) }
  function removeBin(i: number) { dispatch({ type: 'setBins', bins: state.bins.filter((_, k) => k !== i) }) }

  const cols: Column<BinRow>[] = [
    { key: 'label', header: 'Bin', render: (r) => r.label },
    { key: 'customers', header: '# Customers', align: 'right', render: (r) => fmtNum(r.customers) },
    { key: 'revenue', header: 'Contribution', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: '% of Revenue', align: 'right', render: (r) => fmtPct(r.share) },
    { key: 'avgMrr', header: 'Avg MRR', align: 'right', render: (r) => fmtMoney(r.avgMrr) },
    { key: 'avgAcv', header: 'Avg ACV', align: 'right', render: (r) => fmtMoney(r.avgAcv) },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Revenue bins</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-sm font-semibold">Bin thresholds (min &lt; value ≤ max; blank max = open top)</div>
        <div className="space-y-1">
          {state.bins.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input className="w-40 rounded border p-1" value={b.label} onChange={(e) => editBin(i, { label: e.target.value })} />
              <input type="number" className="w-24 rounded border p-1" value={Number.isFinite(b.min) ? b.min : ''} placeholder="-∞"
                onChange={(e) => editBin(i, { min: e.target.value === '' ? -Infinity : Number(e.target.value) })} />
              <span>→</span>
              <input type="number" className="w-24 rounded border p-1" value={b.max ?? ''} placeholder="∞"
                onChange={(e) => editBin(i, { max: e.target.value === '' ? null : Number(e.target.value) })} />
              <button onClick={() => removeBin(i)} className="text-red-500">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addBin} className="mt-2 rounded bg-slate-100 px-3 py-1 text-sm">+ Add bin</button>
      </section>

      <label className="text-sm">Month
        <select className="ml-2 rounded border p-1" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
          {matrix.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      {result && <DataTable columns={cols} rows={result.bins} />}

      <section><h2 className="mb-1 font-semibold">Contribution by bin over time</h2>
        <BarsChart data={trend} xKey="month" stacked series={state.bins.map((b, i) => ({ key: b.label, color: ['#4f46e5', '#0891b2', '#7c3aed', '#f59e0b', '#ef4444', '#22c55e'][i % 6] }))} /></section>
    </div>
  )
}
