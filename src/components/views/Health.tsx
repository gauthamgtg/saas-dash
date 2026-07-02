'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, topCustomers, rfm, healthScore, cadenceDays, revenueVolatility,
  recencyDays, refundFreeShare, refundLatencies, median,
} from '@/src/lib/engine'
import { firstPurchaseToRepeat, timeToSecondPurchaseDays } from '@/src/lib/engine'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Callout } from '@/src/components/ui/Callout'
import { fmtPct } from '@/src/lib/format'

type Row = {
  customerId: string; name: string | null; rfm: number; health: number
  cadence: number | null; volatility: number | null; recency: number | null
}

export function Health() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const asOf = useMemo(() => new Date(Math.max(...txs.map((t) => t.date.getTime()), 0)), [txs])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])

  const rfmMap = useMemo(() => new Map(rfm(txs, asOf).map((r) => [r.customerId, r.score])), [txs, asOf])
  const latency = useMemo(() => median(refundLatencies(txs)), [txs])

  const rows = useMemo<Row[]>(() =>
    topCustomers(txs, 25).map((t) => ({
      customerId: t.customerId, name: t.name,
      rfm: rfmMap.get(t.customerId) ?? 0,
      health: healthScore(m, txs, t.customerId, asOf, state.controls.dormancyDays),
      cadence: cadenceDays(txs, t.customerId),
      volatility: revenueVolatility(m, t.customerId),
      recency: recencyDays(txs, t.customerId, asOf),
    })), [txs, m, asOf, rfmMap, state.controls.dormancyDays])

  const healthTone = (h: number) => (h >= 66 ? 'text-pos' : h >= 33 ? 'text-warn' : 'text-neg')

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name ?? r.customerId },
    { key: 'rfm', header: 'RFM', align: 'right', render: (r) => r.rfm },
    { key: 'health', header: 'Health', align: 'right', render: (r) => <span className={`font-medium ${healthTone(r.health)}`}>{r.health}</span> },
    { key: 'cadence', header: 'Cadence', align: 'right', render: (r) => (r.cadence == null ? '—' : `${Math.round(r.cadence)}d`) },
    { key: 'vol', header: 'Volatility (CV)', align: 'right', render: (r) => (r.volatility == null ? '—' : r.volatility.toFixed(2)) },
    { key: 'rec', header: 'Recency', align: 'right', render: (r) => (r.recency == null ? '—' : `${r.recency}d`) },
  ]

  return (
    <div className="space-y-5">
      <ViewHeader index="07" kicker="CX signals" title="Customer Health" sub="Payments-only engagement, RFM & a transparent health proxy" />
      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="First→repeat conversion" value={fmtPct(firstPurchaseToRepeat(txs))} hint="≥2 payments" />
        <KpiCard label="Median time to 2nd" value={timeToSecondPurchaseDays(txs) == null ? '—' : `${Math.round(timeToSecondPurchaseDays(txs)!)}d`} />
        <KpiCard label="Refund-free customers" value={fmtPct(refundFreeShare(txs))} />
        <KpiCard label="Median refund latency" value={latency == null ? '—' : `${Math.round(latency)}d`} hint="original → refund" />
      </div>
      <DataTable columns={cols} rows={rows} />
      <Callout>Health score is a transparent, tunable proxy from payment signals (recency, MRR trend, refunds, tenure) — not a product-usage or support-ticket score. RFM = Recency+Frequency+Monetary quintiles (3–15).</Callout>
    </div>
  )
}
