'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters, overviewModel } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arpa, nrr, grr, quickRatio, movementSeries, refundBridge, refundRate, invoiceStats } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'

const GRID = 'grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0'

export function Overview() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const model = useMemo(() => overviewModel(txs, state.controls), [txs, state.controls])

  const extra = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const last = m.months[m.months.length - 1] ?? ''
    const prev = addMonths(last, -1)
    return {
      nrr: nrr(m, prev, last), grr: grr(m, prev, last),
      quick: quickRatio(movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })),
      bridge: refundBridge(txs), refund: refundRate(txs), inv: invoiceStats(txs),
    }
  }, [txs, state.controls])

  const trend = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)), ARPA: Math.round(arpa(m, mo) ?? 0) }))
  }, [txs, state.controls])

  return (
    <div className="space-y-5">
      <ViewHeader index="01" kicker="Snapshot" title="Overview" sub={model.month ? `As of ${model.month}` : 'No data'} />

      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-3 lg:grid-cols-6 [&>*]:border-0">
        <KpiCard label="MRR" value={fmtMoney(model.mrr)} />
        <KpiCard label="ARR" value={fmtMoney(model.arr)} />
        <KpiCard label="ARPA" value={fmtMoney(model.arpa)} />
        <KpiCard label="Active customers" value={fmtNum(model.activeCustomers)} />
        <KpiCard label="Logo churn (MoM)" value={fmtPct(model.logoChurn)} />
        <KpiCard label="Avg lifetime" value={model.avgLifetime == null ? '—' : `${model.avgLifetime.toFixed(1)} mo`} />
      </div>

      <div>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Retention & efficiency (MoM)</h2>
        <div className={GRID}>
          <KpiCard label="Net revenue retention" value={fmtPct(extra.nrr)} tone={extra.nrr != null && extra.nrr >= 1 ? 'pos' : 'default'} />
          <KpiCard label="Gross revenue retention" value={fmtPct(extra.grr)} />
          <KpiCard label="Quick ratio" value={extra.quick == null ? '—' : extra.quick.toFixed(2)} hint="inflow ÷ outflow" />
          <KpiCard label="Refund rate" value={fmtPct(extra.refund)} hint="proxy — dissatisfaction" tone={extra.refund ? 'neg' : 'default'} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Bookings</h2>
        <div className={GRID}>
          <KpiCard label="Net revenue" value={fmtMoney(extra.bridge.net)} hint={`gross ${fmtMoney(extra.bridge.gross)} − refunds ${fmtMoney(extra.bridge.refunded)}`} />
          <KpiCard label="Distinct invoices" value={fmtNum(extra.inv.distinctInvoices)} />
          <KpiCard label="Avg invoice value" value={fmtMoney(extra.inv.avgInvoiceValue)} />
          <KpiCard label="Avg payment size" value={fmtMoney(extra.inv.avgPaymentSize)} />
        </div>
      </div>

      <TrendChart data={trend} xKey="month" series={[{ key: 'MRR', color: CHART.navy }, { key: 'ARPA', color: CHART.steel }]} />
      <Callout>NRR/GRR shown month-over-month (prior → latest). Refund rate is a dissatisfaction proxy, not a survey metric. Cost-dependent metrics (LTV:CAC, Magic Number, Rule-of-40 profit half) are omitted — this dataset has no spend data.</Callout>
    </div>
  )
}
