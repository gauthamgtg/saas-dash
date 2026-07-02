'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, binAnalysis, binSeries, gini, paretoConcentration, hhi, revenueDeciles, whaleVsLongTail } from '@/src/lib/engine'
import type { BinDef } from '@/src/lib/types'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { CHART } from '@/src/lib/theme'
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
      <ViewHeader index="08" kicker="Distribution" title="Revenue Bins" sub="Customers bucketed by monthly revenue — bins are fully editable" />

      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="Revenue Gini" value={gini(txs) == null ? '—' : gini(txs)!.toFixed(3)} hint="0 equal … 1 concentrated" />
        <KpiCard label="Top-20% share" value={fmtPct(paretoConcentration(txs).top20Share)} />
        <KpiCard label="Customers to 80%" value={fmtPct(paretoConcentration(txs).customersToEightyPct)} hint="fewer = whale-heavy" />
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} />
      </div>

      <section className="border border-line bg-paper p-4">
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Bin thresholds (min &lt; value ≤ max; blank max = open top)</div>
        <div className="space-y-1">
          {state.bins.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input className="w-40 border border-line-strong p-1" value={b.label} onChange={(e) => editBin(i, { label: e.target.value })} />
              <input type="number" className="w-24 border border-line-strong p-1" value={Number.isFinite(b.min) ? b.min : ''} placeholder="-∞"
                onChange={(e) => editBin(i, { min: e.target.value === '' ? -Infinity : Number(e.target.value) })} />
              <span>→</span>
              <input type="number" className="w-24 border border-line-strong p-1" value={b.max ?? ''} placeholder="∞"
                onChange={(e) => editBin(i, { max: e.target.value === '' ? null : Number(e.target.value) })} />
              <button onClick={() => removeBin(i)} className="text-red-500">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addBin} className="mt-3 rounded-md border border-line-strong px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink-soft hover:bg-paper-2 hover:text-ink">+ Add bin</button>
      </section>

      <label className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Month
        <select className="ml-2 px-2 py-1 text-sm normal-case tracking-normal" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
          {matrix.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      {result && <DataTable columns={cols} rows={result.bins} />}

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Contribution by bin over time</h2>
        <BarsChart data={trend} xKey="month" stacked series={state.bins.map((b, i) => ({ key: b.label, color: CHART.series[i % CHART.series.length] }))} /></section>

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue deciles & whales</h2>
        {(() => {
          const whale = whaleVsLongTail(txs, 0.2)
          const deciles = revenueDeciles(txs)
          return (
            <>
              <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
                <KpiCard label="Whales (top 20%)" value={fmtNum(whale.whaleCount)} />
                <KpiCard label="Whale revenue share" value={fmtPct(whale.whaleShare)} />
                <KpiCard label="Long-tail count" value={fmtNum(whale.tailCount)} />
                <KpiCard label="Long-tail share" value={fmtPct(whale.tailShare)} />
              </div>
              <div className="grid grid-cols-5 gap-px border border-line bg-line text-center md:grid-cols-10 [&>*]:border-0">
                {deciles.map((d) => (
                  <div key={d.decile} className="bg-paper p-2">
                    <div className="font-mono text-[10px] text-ink-soft">D{d.decile}</div>
                    <div className="font-mono text-sm font-medium tabular-nums">{fmtPct(d.share)}</div>
                    <div className="font-mono text-[10px] text-ink-faint tabular-nums">{fmtNum(d.customers)}c</div>
                  </div>
                ))}
              </div>
            </>
          )
        })()}
      </section>
    </div>
  )
}
