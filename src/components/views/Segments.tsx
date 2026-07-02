'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { revenueByDimension, hhi, topNShare } from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtNum } from '@/src/lib/format'

export function Segments() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const region = useMemo(() => revenueByDimension(txs, 'region').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])
  const model = useMemo(() => revenueByDimension(txs, 'businessModel').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])
  const currency = useMemo(() => revenueByDimension(txs, 'currency').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])

  return (
    <div className="space-y-5">
      <ViewHeader index="04" kicker="Breakdown" title="Segments" sub="Where the revenue sits, and how concentrated it is" />
      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} hint="0–10,000; >2500 concentrated" />
        <KpiCard label="Top-1 share" value={fmtPct(topNShare(txs, 1))} />
        <KpiCard label="Top-5 share" value={fmtPct(topNShare(txs, 5))} />
        <KpiCard label="Top-10 share" value={fmtPct(topNShare(txs, 10))} />
      </div>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by region</h2>
        <BarsChart data={region} xKey="key" series={[{ key: 'Revenue', color: CHART.navy }]} /></section>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by business model</h2>
        <BarsChart data={model} xKey="key" series={[{ key: 'Revenue', color: CHART.steel }]} /></section>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by currency</h2>
        <BarsChart data={currency} xKey="key" series={[{ key: 'Revenue', color: CHART.warn }]} /></section>
    </div>
  )
}
