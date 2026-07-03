'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { useAnnotations } from '@/src/state/annotations'
import { applyFilters, overviewModel } from '@/src/lib/dashboard'
import {
  buildMatrix, get, mrrOf, arpa, nrr, grr, quickRatio, movementSeries,
  refundBridge, refundRate, invoiceStats, activeCustomers, mrrForecast, timelineMarkers,
} from '@/src/lib/engine'
import { addMonths, COMPARE_OFFSET, COMPARE_LABEL } from '@/src/lib/types'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { ForecastChart } from '@/src/components/ui/ForecastChart'
import { RefundBridge } from '@/src/components/ui/RefundBridge'
import { Panel } from '@/src/components/ui/Panel'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:border-0'
const rel = (a: number, b: number) => (b ? (a - b) / b : null)

export function Overview() {
  const { state } = useApp()
  const { notes, add, clear } = useAnnotations()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const model = useMemo(() => overviewModel(txs, state.controls), [txs, state.controls])

  function addNote() {
    const month = window.prompt('Annotate which month? (YYYY-MM)')?.trim()
    if (!month) return
    const label = window.prompt('Note text')?.trim()
    if (label) add(month, label)
  }

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const months = m.months
    const last = months[months.length - 1] ?? ''
    const prev = months.length > 1 ? months[months.length - 2] : addMonths(last, -1)
    const mrrSeries = months.map((mo) => Math.round(mrrOf(m, mo)))
    const activeSer = months.map((mo) => activeCustomers(m, mo))
    const off = COMPARE_OFFSET[state.controls.comparePeriod]
    const ghostKey = `MRR · ${COMPARE_LABEL[state.controls.comparePeriod]}`
    const mrrChart = months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i], ...(off && i >= off ? { [ghostKey]: mrrSeries[i - off] } : {}) }))
    const hasGhost = off > 0 && mrrChart.some((r) => ghostKey in r)

    // per-segment MRR small multiples
    const models = [...new Set(txs.map((t) => t.businessModel ?? 'Unknown'))]
    const segs = models.map((name) => {
      const custs = new Set(txs.filter((t) => (t.businessModel ?? 'Unknown') === name).map((t) => t.customerId))
      const series = months.map((mo) => Math.round([...custs].reduce((s, c) => s + get(m, c, mo), 0)))
      return { name, series, last: series[series.length - 1], delta: rel(series[series.length - 1], series[series.length - 2] ?? 0) }
    }).sort((a, b) => b.last - a.last)

    return {
      mrrChart, hasGhost, ghostKey, mrrSeries, activeSer, segs,
      mrrObserved: months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i] })),
      forecast: mrrForecast(m, 6), markers: timelineMarkers(m, state.controls.reactivationGapK),
      mrrDelta: rel(mrrOf(m, last), mrrOf(m, prev)), activeDelta: rel(activeCustomers(m, last), activeCustomers(m, prev)),
      arpaDelta: (() => { const a = arpa(m, last), b = arpa(m, prev); return a != null && b != null ? rel(a, b) : null })(),
      nrr: nrr(m, prev, last), grr: grr(m, prev, last), quick: quickRatio(movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })),
      bridge: refundBridge(txs), refund: refundRate(txs), inv: invoiceStats(txs),
    }
  }, [txs, state.controls])

  return (
    <div className="space-y-4">
      <ViewHeader index="01" kicker="Snapshot" title="Overview" sub={model.month ? `As of ${model.month}` : 'No data'} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard hero icon="$" iconColor="var(--accent)" label="MRR" value={fmtMoney(model.mrr)} delta={d.mrrDelta} />
        <KpiCard hero icon="Σ" iconColor="var(--steel)" label="ARR" value={fmtMoneyShort(model.arr)} delta={d.mrrDelta} />
        <KpiCard hero icon="◑" iconColor="var(--violet)" label="ARPA" value={fmtMoney(model.arpa)} delta={d.arpaDelta} />
        <KpiCard hero icon="◉" iconColor="var(--pos)" label="Active customers" value={fmtNum(model.activeCustomers)} delta={d.activeDelta} />
        <KpiCard hero icon="↘" iconColor="var(--neg)" label="Logo churn (MoM)" value={fmtPct(model.logoChurn)} tone={model.logoChurn ? 'neg' : 'default'} />
        <KpiCard hero icon="⧗" iconColor="var(--warn)" label="Avg lifetime" value={model.avgLifetime == null ? '—' : `${model.avgLifetime.toFixed(1)} mo`} />
      </div>

      <Panel title="MRR trajectory" sub={d.hasGhost ? `solid = now · dashed = ${d.ghostKey.replace('MRR · ', '')} · markers = notable months` : 'markers = notable months'}
        right={<div className="flex items-center gap-2">
          {notes.length > 0 && <button onClick={clear} className="font-mono text-[10px] uppercase tracking-wider text-ink-faint hover:text-neg">clear notes</button>}
          <button onClick={addNote} className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-soft hover:bg-paper-2 hover:text-ink">＋ note</button>
        </div>}>
        <TrendChart data={d.mrrChart} xKey="month" area height={280} markers={[...d.markers, ...notes]}
          series={[{ key: 'MRR', color: CHART.accent }, ...(d.hasGhost ? [{ key: d.ghostKey, color: CHART.ink, ghost: true }] : [])]} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRR forecast" sub="modeled — trailing CMGR run-rate, ±uncertainty cone">
          {d.forecast.length ? <ForecastChart observed={d.mrrObserved} forecast={d.forecast} height={260} />
            : <p className="py-12 text-center font-mono text-xs text-ink-faint">Need more history to project</p>}
        </Panel>
        <Panel title="Gross → net revenue" sub="lifetime bookings after refunds">
          <RefundBridge gross={d.bridge.gross} refunded={d.bridge.refunded} net={d.bridge.net} height={260} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Retention & efficiency (MoM)</h2>
        <div className={KSTRIP}>
          <KpiCard label="Net revenue retention" value={fmtPct(d.nrr)} tone={d.nrr != null && d.nrr >= 1 ? 'pos' : 'default'} hint="benchmark ≥ 100%" />
          <KpiCard label="Gross revenue retention" value={fmtPct(d.grr)} hint="benchmark ~90%" />
          <KpiCard label="Quick ratio" value={d.quick == null ? '—' : d.quick.toFixed(2)} hint="healthy ≥ 4" tone={d.quick != null && d.quick >= 4 ? 'pos' : 'default'} />
          <KpiCard label="Refund rate" value={fmtPct(d.refund)} hint="dissatisfaction proxy" tone={d.refund ? 'neg' : 'default'} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Bookings</h2>
        <div className={KSTRIP}>
          <KpiCard label="Net revenue" value={fmtMoney(d.bridge.net)} hint={`gross ${fmtMoney(d.bridge.gross)} − refunds ${fmtMoney(d.bridge.refunded)}`} />
          <KpiCard label="Distinct invoices" value={fmtNum(d.inv.distinctInvoices)} />
          <KpiCard label="Avg invoice value" value={fmtMoney(d.inv.avgInvoiceValue)} />
          <KpiCard label="Avg payment size" value={fmtMoney(d.inv.avgPaymentSize)} />
        </div>
      </div>

      <Panel title="MRR by segment" sub="per-model trajectory (small multiples)">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {d.segs.map((s) => (
            <div key={s.name} className="rounded-lg border border-line bg-paper-2 p-3">
              <div className="flex items-center justify-between">
                <div className="truncate font-mono text-[10px] uppercase tracking-wider text-ink-soft">{s.name}</div>
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div className="font-mono text-lg font-semibold tabular-nums text-ink">{fmtMoney(s.last)}</div>
                <Sparkline data={s.series} w={64} h={22} color={s.delta != null && s.delta < 0 ? 'var(--neg)' : 'var(--accent)'} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Callout>NRR/GRR shown month-over-month (prior → latest). Benchmarks are common SaaS reference points, not peer-calibrated. Cost-dependent metrics (LTV:CAC, Magic Number, Rule-of-40) are omitted — this dataset has no spend data.</Callout>
    </div>
  )
}
