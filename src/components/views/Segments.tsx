'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  revenueByDimension, hhi, topNShare, gini, paretoConcentration,
  dominantCurrencyShare, dimensionHhi, newVsRepeatRevenue, buildMatrix,
} from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtNum } from '@/src/lib/format'

const bars = (rows: { key: string; revenue: number }[]) => rows.map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) }))

export function Segments() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const region = useMemo(() => bars(revenueByDimension(txs, 'region')), [txs])
  const country = useMemo(() => bars(revenueByDimension(txs, 'country')), [txs])
  const model = useMemo(() => bars(revenueByDimension(txs, 'businessModel')), [txs])
  const currency = useMemo(() => bars(revenueByDimension(txs, 'currency')), [txs])
  const pareto = useMemo(() => paretoConcentration(txs), [txs])
  const nvr = useMemo(() => {
    const r = newVsRepeatRevenue(buildMatrix(txs, state.controls.mode))
    const total = r.newRevenue + r.repeatRevenue
    return total ? r.newRevenue / total : null
  }, [txs, state.controls])

  return (
    <div className="space-y-5">
      <ViewHeader index="04" kicker="Breakdown" title="Segments" sub="Where the revenue sits, and how concentrated it is" />

      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} hint="0–10,000; >2500 concentrated" tone={hhi(txs) > 2500 ? 'neg' : 'default'} />
        <KpiCard label="Top-1 share" value={fmtPct(topNShare(txs, 1))} />
        <KpiCard label="Top-5 share" value={fmtPct(topNShare(txs, 5))} />
        <KpiCard label="Top-10 share" value={fmtPct(topNShare(txs, 10))} />
        <KpiCard label="Revenue Gini" value={gini(txs) == null ? '—' : gini(txs)!.toFixed(3)} hint="0 equal … 1 concentrated" />
        <KpiCard label="Top-20% share" value={fmtPct(pareto.top20Share)} />
        <KpiCard label="New-revenue share" value={fmtPct(nvr)} hint="vs repeat (first-active month)" />
        <KpiCard label="Dominant currency" value={fmtPct(dominantCurrencyShare(txs))} hint="FX exposure" />
      </div>

      <div className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="Region HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'region')))} />
        <KpiCard label="Country HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'country')))} />
        <KpiCard label="Model HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'businessModel')))} />
        <KpiCard label="Currency HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'currency')))} />
      </div>

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by region</h2>
        <BarsChart data={region} xKey="key" series={[{ key: 'Revenue', color: CHART.navy }]} /></section>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by country</h2>
        <BarsChart data={country} xKey="key" series={[{ key: 'Revenue', color: CHART.pos }]} /></section>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by business model</h2>
        <BarsChart data={model} xKey="key" series={[{ key: 'Revenue', color: CHART.steel }]} /></section>
      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Revenue by currency</h2>
        <BarsChart data={currency} xKey="key" series={[{ key: 'Revenue', color: CHART.warn }]} /></section>
      <Callout>HHI on the 0–10,000 scale (&gt;2500 = concentrated). Pareto/Gini computed on lifetime per-customer revenue.</Callout>
    </div>
  )
}
