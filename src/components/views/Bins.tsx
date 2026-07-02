'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, binAnalysis, binSeries, gini, paretoConcentration, hhi, revenueDeciles, whaleVsLongTail } from '@/src/lib/engine'
import type { BinDef } from '@/src/lib/types'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'
import type { BinRow } from '@/src/lib/engine'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:border-0'

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

  function editBin(i: number, patch: Partial<BinDef>) { dispatch({ type: 'setBins', bins: state.bins.map((b, k) => (k === i ? { ...b, ...patch } : b)) }) }
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

  const whale = whaleVsLongTail(txs, 0.2)
  const deciles = revenueDeciles(txs)

  return (
    <div className="space-y-4">
      <ViewHeader index="08" kicker="Distribution" title="Revenue Bins" sub="Customers bucketed by monthly revenue — bins are fully editable" />

      <div className={KSTRIP}>
        <KpiCard label="Revenue Gini" value={gini(txs) == null ? '—' : gini(txs)!.toFixed(3)} hint="0 equal … 1 concentrated" />
        <KpiCard label="Top-20% share" value={fmtPct(paretoConcentration(txs).top20Share)} />
        <KpiCard label="Customers to 80%" value={fmtPct(paretoConcentration(txs).customersToEightyPct)} hint="fewer = whale-heavy" />
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} />
      </div>

      <Panel title="Bin thresholds" sub="min < value ≤ max · blank max = open top"
        right={<label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Month
          <select className="px-2 py-1 text-sm normal-case tracking-normal" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
            {matrix.months.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
          </select></label>}>
        <div className="space-y-1">
          {state.bins.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input className="w-40 rounded-md p-1" value={b.label} onChange={(e) => editBin(i, { label: e.target.value })} />
              <input type="number" className="w-24 rounded-md p-1" value={Number.isFinite(b.min) ? b.min : ''} placeholder="-∞" onChange={(e) => editBin(i, { min: e.target.value === '' ? -Infinity : Number(e.target.value) })} />
              <span className="text-ink-faint">→</span>
              <input type="number" className="w-24 rounded-md p-1" value={b.max ?? ''} placeholder="∞" onChange={(e) => editBin(i, { max: e.target.value === '' ? null : Number(e.target.value) })} />
              <button onClick={() => removeBin(i)} className="text-neg hover:opacity-70">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addBin} className="mt-3 rounded-md border border-line-strong px-3 py-1 font-mono text-xs uppercase tracking-wider text-ink-soft hover:bg-paper-2 hover:text-ink">+ Add bin</button>
      </Panel>

      {result && <Panel title={`Bin breakdown · ${activeMonth}`}><DataTable columns={cols} rows={result.bins} /></Panel>}

      <Panel title="Contribution by bin over time" sub="stacked monthly revenue">
        <BarsChart data={trend} xKey="month" stacked height={300} series={state.bins.map((b, i) => ({ key: b.label, color: CHART.series[i % CHART.series.length] }))} />
      </Panel>

      <Panel title="Revenue deciles & whales" sub="customers ranked into ten equal groups by revenue">
        <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4 [&>*]:border-0">
          <KpiCard label="Whales (top 20%)" value={fmtNum(whale.whaleCount)} />
          <KpiCard label="Whale revenue share" value={fmtPct(whale.whaleShare)} tone={whale.whaleShare > 0.6 ? 'neg' : 'default'} />
          <KpiCard label="Long-tail count" value={fmtNum(whale.tailCount)} />
          <KpiCard label="Long-tail share" value={fmtPct(whale.tailShare)} />
        </div>
        <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-line bg-line text-center md:grid-cols-10 [&>*]:border-0">
          {deciles.map((d) => (
            <div key={d.decile} className="bg-paper p-2">
              <div className="font-mono text-[10px] text-ink-soft">D{d.decile}</div>
              <div className="font-mono text-sm font-medium tabular-nums">{fmtPct(d.share)}</div>
              <div className="font-mono text-[10px] tabular-nums text-ink-faint">{fmtNum(d.customers)}c</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
