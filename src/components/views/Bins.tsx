'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, binAnalysis, binSeries, binMigration, gini, paretoConcentration, hhi, revenueDeciles, whaleVsLongTail, get } from '@/src/lib/engine'
import { DEFAULT_BINS, type BinDef } from '@/src/lib/types'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { DetailDrawer, type Drill } from '@/src/components/ui/DetailDrawer'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { PercentToggle } from '@/src/components/ui/PercentToggle'
import { Select } from '@/src/components/ui/Select'
import { SankeyChart } from '@/src/components/ui/SankeyChart'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'
import type { BinRow } from '@/src/lib/engine'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'

const FIELD = 'h-8 rounded-lg border border-line bg-paper px-2.5 text-[13px] text-ink outline-none transition-colors hover:border-line-strong focus:border-accent'

/** Currency threshold input; blank = unbounded. */
function Money({ value, placeholder, bad, label, onChange }: { value: number | null; placeholder: string; bad: boolean; label: string; onChange: (v: number | null) => void }) {
  return (
    <div className="relative w-28">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-faint">$</span>
      <input type="number" min={0} aria-label={label} className={`${FIELD} w-full pl-6 tabular-nums placeholder:text-ink-faint ${bad ? 'border-warn' : ''}`}
        value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
    </div>
  )
}

export function Bins() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const matrix = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])
  const [month, setMonth] = useState('')
  const [drill, setDrill] = useState<Drill>(null)
  const [binPercent, setBinPercent] = useState(true)
  const activeMonth = month || matrix.months[matrix.months.length - 1] || ''

  function drillBin(b: BinRow) {
    const def = state.bins.find((x) => x.label === b.label)
    if (!def) return
    const names = new Map<string, string | null>()
    for (const t of txs) if (!names.has(t.customerId)) names.set(t.customerId, t.name)
    const rows = matrix.customers
      .map((c) => ({ c, v: get(matrix, c, activeMonth) }))
      .filter(({ v }) => v > (def.min as number) && (def.max == null || v <= def.max))
      .sort((a, z) => z.v - a.v)
      .map(({ c, v }) => ({ name: names.get(c) ?? c, value: fmtMoney(v) }))
    setDrill({ title: b.label, subtitle: `${rows.length} accounts · ${activeMonth}`, rows })
  }

  const result = useMemo(() => (activeMonth ? binAnalysis(matrix, activeMonth, state.bins) : null), [matrix, activeMonth, state.bins])
  const prevMonth = matrix.months[matrix.months.indexOf(activeMonth) - 1] ?? ''
  const migration = useMemo(() => (prevMonth ? binMigration(matrix, state.bins, prevMonth, activeMonth) : { nodes: [], links: [] }), [matrix, state.bins, prevMonth, activeMonth])
  const trend = useMemo(() => binSeries(matrix, state.bins).map((r) => {
    const row: Record<string, any> = { month: r.month }
    r.bins.forEach((b) => { row[b.label] = Math.round(b.revenue) })
    return row
  }), [matrix, state.bins])

  function editBin(i: number, patch: Partial<BinDef>) { dispatch({ type: 'setBins', bins: state.bins.map((b, k) => (k === i ? { ...b, ...patch } : b)) }) }
  function addBin() {
    const lastMax = state.bins[state.bins.length - 1]?.max ?? 0
    dispatch({ type: 'setBins', bins: [...state.bins, { label: 'New bin', min: lastMax, max: null }] })
  }
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

      <Panel title="Bin thresholds" sub="Accounts land in a bin when monthly revenue is above From and at or below To · bars show share of MRR"
        right={<div className="flex items-center gap-2">
          <button onClick={() => dispatch({ type: 'setBins', bins: DEFAULT_BINS })}
            className="h-8 rounded-lg px-2.5 text-[12px] font-medium text-ink-faint hover:bg-paper-2 hover:text-ink">Reset</button>
          <Select value={activeMonth} onChange={setMonth} options={matrix.months.map((mm) => ({ value: mm, label: mm }))} />
        </div>}>
        {/* revenue share per bin — shows at a glance how the thresholds carve up the book */}
        {result && result.total > 0 && (
          <div className="mb-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
            {result.bins.map((r, i) => r.share > 0 && (
              <div key={i} title={`${r.label}: ${fmtPct(r.share)}`} style={{ width: `${r.share * 100}%`, background: CHART.series[i % CHART.series.length] }} />
            ))}
          </div>
        )}
        <div className="divide-y divide-line border-y border-line">
          {state.bins.map((b, i) => {
            const r = result?.bins[i]
            const next = state.bins[i + 1]
            const bad = b.max != null && b.max <= b.min
            const seam = next && b.max != null && next.min !== b.max ? (next.min > b.max ? 'gap' : 'overlap') : null
            const color = CHART.series[i % CHART.series.length]
            return (
              <div key={i} className="group py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <label className="flex min-w-[9rem] flex-1 items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: color }} />
                    <input className={`${FIELD} min-w-0 flex-1 font-medium`} value={b.label} aria-label="Bin name" onChange={(e) => editBin(i, { label: e.target.value })} />
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Money value={Number.isFinite(b.min) ? b.min : null} placeholder="No floor" bad={bad} label="From"
                      onChange={(v) => editBin(i, { min: v ?? -Infinity })} />
                    <span className="text-[12px] text-ink-faint">to</span>
                    <Money value={b.max} placeholder="No cap" bad={bad} label="To" onChange={(v) => editBin(i, { max: v })} />
                  </div>
                  <button onClick={() => removeBin(i)} aria-label={`Remove ${b.label}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:bg-neg/10 hover:text-neg lg:order-last lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" /></svg>
                  </button>
                  <div className="order-last flex w-full items-center gap-2.5 pl-[22px] lg:order-none lg:w-60 lg:pl-0">
                    <span className="w-14 shrink-0 text-[12.5px] tabular-nums text-ink">{fmtNum(r?.customers ?? 0)} <span className="text-ink-faint">acc</span></span>
                    <div className="h-1.5 min-w-0 flex-1 rounded-full bg-paper-2">
                      <div className="h-full rounded-full" style={{ width: `${(r?.share ?? 0) * 100}%`, background: color }} />
                    </div>
                    <span className="w-11 shrink-0 text-right text-[12px] tabular-nums text-ink-soft">{fmtPct(r?.share ?? 0)}</span>
                  </div>
                </div>
                {(bad || seam) && (
                  <p className="mt-1.5 pl-[22px] text-[11.5px] text-warn">
                    {bad ? 'To must be greater than From.' : `${seam === 'gap' ? 'Gap' : 'Overlap'} with the next bin — accounts between ${fmtMoney(Math.min(b.max!, next!.min))} and ${fmtMoney(Math.max(b.max!, next!.min))} ${seam === 'gap' ? 'fall into no bin' : 'land in this one'}.`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={addBin}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 text-[12.5px] font-medium text-ink-soft hover:border-ink-faint hover:text-ink">
          <span className="text-[15px] leading-none">+</span> Add bin
        </button>
      </Panel>

      {result && <Panel title={`Bin breakdown · ${activeMonth}`} sub="click a bin to see its accounts"><DataTable columns={cols} rows={result.bins} onRowClick={drillBin} /></Panel>}

      {prevMonth && (
        <Panel title="Bin migration" sub={`customers moving between bins · ${prevMonth} → ${activeMonth} (bin proxy — no plan IDs)`}>
          <SankeyChart graph={migration} height={340} />
        </Panel>
      )}

      <Panel title="Contribution by bin over time" sub={binPercent ? 'share of monthly revenue' : 'stacked monthly revenue'}
        right={<PercentToggle percent={binPercent} onChange={setBinPercent} />}>
        <BarsChart data={trend} xKey="month" stacked percent={binPercent} height={300} series={state.bins.map((b, i) => ({ key: b.label, color: CHART.series[i % CHART.series.length] }))} />
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
              <div className="text-[10px] text-ink-soft tabular-nums">D{d.decile}</div>
              <div className="text-sm font-medium tabular-nums">{fmtPct(d.share)}</div>
              <div className="text-[10px] tabular-nums text-ink-faint">{fmtNum(d.customers)}c</div>
            </div>
          ))}
        </div>
      </Panel>

      <DetailDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
