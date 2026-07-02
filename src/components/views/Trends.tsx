'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, activeSeries, newLogosSeries, netLogoSeries, seasonalityIndex,
  currencyMixSeries, newMarketEntrySeries, billingFrequencyMix, t2d3,
} from '@/src/lib/engine'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Callout } from '@/src/components/ui/Callout'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtMoney } from '@/src/lib/format'

export function Trends() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])

  const logos = useMemo(() => {
    const active = activeSeries(m), nl = newLogosSeries(m), net = netLogoSeries(m)
    return m.months.map((mo, i) => ({ month: mo, Active: active[i].active, New: nl[i].newLogos, Net: net[i].net }))
  }, [m])
  const season = useMemo(() => seasonalityIndex(m), [m])
  const mix = useMemo(() => currencyMixSeries(txs), [txs])
  const markets = useMemo(() => newMarketEntrySeries(txs), [txs])
  const billing = useMemo(() => billingFrequencyMix(txs), [txs])
  const traj = useMemo(() => t2d3(m), [m])

  const t2d3Cols: Column<(typeof traj)[number]>[] = [
    { key: 'year', header: 'Year', render: (r) => `Y${r.year}` },
    { key: 'arr', header: 'ARR', align: 'right', render: (r) => fmtMoney(r.arr) },
    { key: 'mult', header: 'YoY ×', align: 'right', render: (r) => (r.multiple == null ? '—' : `${r.multiple.toFixed(2)}×`) },
    { key: 'target', header: 'Target', align: 'right', render: (r) => (Number.isNaN(r.target) ? '—' : `${r.target}×`) },
    { key: 'ok', header: 'On track', render: (r) => r.onTrack == null ? '—' : r.onTrack ? <span className="text-pos">✓</span> : <span className="text-neg">✗</span> },
  ]

  return (
    <div className="space-y-6">
      <ViewHeader index="03" kicker="Time series" title="Trends" sub="Customer counts, acquisition, cadence & trajectory over time" />

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Active customers</h2>
        <TrendChart data={logos} xKey="month" series={[{ key: 'Active', color: CHART.navy }]} /></section>

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">New logos & net logo growth</h2>
        <BarsChart data={logos} xKey="month" series={[{ key: 'New', color: CHART.pos }, { key: 'Net', color: CHART.steel }]} /></section>

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Currency mix (base revenue)</h2>
        <BarsChart data={mix.rows as Record<string, number>[]} xKey="month" stacked
          series={mix.currencies.map((c, i) => ({ key: c, color: CHART.series[i % CHART.series.length] }))} /></section>

      <div>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Billing cadence mix</h2>
        <div className="grid grid-cols-3 gap-px border border-line bg-line [&>*]:border-0">
          <KpiCard label="Monthly" value={fmtPct(billing.monthly)} />
          <KpiCard label="Quarterly" value={fmtPct(billing.quarterly)} />
          <KpiCard label="Annual / lump" value={fmtPct(billing.annualOrLump)} />
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">Inferred from inter-payment gaps — heuristic, single-payment customers count as lump.</p>
      </div>

      <section className="space-y-1"><h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">New markets entered / month</h2>
        <BarsChart data={markets} xKey="month" series={[{ key: 'newMarkets', name: 'New countries', color: CHART.warn }]} /></section>

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Seasonality (calendar-month index)</h2>
        {season
          ? <TrendChart data={season} xKey="calMonth" series={[{ key: 'index', name: 'Index (100=avg)', color: CHART.navy }]} />
          : <Callout>Needs ≥24 months (2 full years) of history to compute a stable seasonal index.</Callout>}
      </section>

      <section className="space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">T2D3 trajectory</h2>
        {traj.length
          ? <DataTable columns={t2d3Cols} rows={traj} />
          : <Callout>Needs ≥24 months (2 full years) of history to compare year-over-year ARR against the 3·3·2·2·2 benchmark.</Callout>}
      </section>
    </div>
  )
}
