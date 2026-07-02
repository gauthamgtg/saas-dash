'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, topCustomers, rfm, healthScore, cadenceDays, revenueVolatility,
  recencyDays, refundFreeShare, refundLatencies, median,
  firstPurchaseToRepeat, timeToSecondPurchaseDays,
} from '@/src/lib/engine'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Callout } from '@/src/components/ui/Callout'
import { fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:border-0'
type Row = { customerId: string; name: string | null; rfm: number; health: number; cadence: number | null; volatility: number | null; recency: number | null }

function pctile(arr: number[], p: number): number | null {
  const a = arr.filter((v) => Number.isFinite(v)).sort((x, y) => x - y)
  if (!a.length) return null
  return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1)))]
}

export function Health() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const asOf = useMemo(() => new Date(Math.max(...txs.map((t) => t.date.getTime()), 0)), [txs])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])

  const rfmMap = useMemo(() => new Map(rfm(txs, asOf).map((r) => [r.customerId, r.score])), [txs, asOf])
  const latency = useMemo(() => median(refundLatencies(txs)), [txs])

  // full-population distributions
  const dist = useMemo(() => {
    const health: number[] = [], cadence: number[] = [], vol: number[] = [], rec: number[] = []
    for (const c of m.customers) {
      health.push(healthScore(m, txs, c, asOf, state.controls.dormancyDays))
      const cd = cadenceDays(txs, c); if (cd != null) cadence.push(cd)
      const v = revenueVolatility(m, c); if (v != null) vol.push(v)
      const r = recencyDays(txs, c, asOf); if (r != null) rec.push(r)
    }
    const strip = (label: string, arr: number[], fmt: (n: number) => string) => ({
      label, p25: pctile(arr, 0.25), p50: pctile(arr, 0.5), p75: pctile(arr, 0.75), p90: pctile(arr, 0.9), fmt,
    })
    return [
      strip('Health score', health, (n) => Math.round(n).toString()),
      strip('Payment cadence (d)', cadence, (n) => `${Math.round(n)}d`),
      strip('Revenue volatility (CV)', vol, (n) => n.toFixed(2)),
      strip('Recency (d)', rec, (n) => `${Math.round(n)}d`),
    ]
  }, [m, txs, asOf, state.controls.dormancyDays])

  const rows = useMemo<Row[]>(() =>
    topCustomers(txs, 25).map((t) => ({
      customerId: t.customerId, name: t.name, rfm: rfmMap.get(t.customerId) ?? 0,
      health: healthScore(m, txs, t.customerId, asOf, state.controls.dormancyDays),
      cadence: cadenceDays(txs, t.customerId), volatility: revenueVolatility(m, t.customerId),
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
    <div className="space-y-4">
      <ViewHeader index="07" kicker="CX signals" title="Customer Health" sub="Payments-only engagement, RFM & a transparent health proxy" />
      <div className={KSTRIP}>
        <KpiCard label="First→repeat conversion" value={fmtPct(firstPurchaseToRepeat(txs))} hint="≥2 payments" />
        <KpiCard label="Median time to 2nd" value={timeToSecondPurchaseDays(txs) == null ? '—' : `${Math.round(timeToSecondPurchaseDays(txs)!)}d`} />
        <KpiCard label="Refund-free customers" value={fmtPct(refundFreeShare(txs))} />
        <KpiCard label="Median refund latency" value={latency == null ? '—' : `${Math.round(latency)}d`} hint="original → refund" />
      </div>

      <Panel title="Distribution" sub="percentiles across all customers — denser than a single average" bodyClass="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="pb-2 font-medium">Metric</th><th className="pb-2 text-right font-medium">p25</th>
            <th className="pb-2 text-right font-medium">median</th><th className="pb-2 text-right font-medium">p75</th><th className="pb-2 text-right font-medium">p90</th></tr></thead>
          <tbody>
            {dist.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-2 text-ink">{d.label}</td>
                {[d.p25, d.p50, d.p75, d.p90].map((v, i) => <td key={i} className="py-2 text-right font-mono tabular-nums text-ink-soft">{v == null ? '—' : d.fmt(v)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Top accounts — health signals"><DataTable columns={cols} rows={rows} /></Panel>
      <Callout>Health score is a transparent, tunable proxy from payment signals (recency, MRR trend, refunds, tenure) — not product-usage or support data. RFM = Recency+Frequency+Monetary quintiles (3–15).</Callout>
    </div>
  )
}
