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
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Callout } from '@/src/components/ui/Callout'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtMoney } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:border-0'

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
    <div className="space-y-4">
      <ViewHeader index="03" kicker="Time series" title="Trends" sub="Customer counts, acquisition, cadence & trajectory over time" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Active customers"><TrendChart data={logos} xKey="month" area height={240} series={[{ key: 'Active', color: CHART.accent }]} /></Panel>
        <Panel title="New logos & net logo growth"><BarsChart data={logos} xKey="month" height={240} series={[{ key: 'New', color: CHART.pos }, { key: 'Net', color: CHART.steel }]} /></Panel>
      </div>

      <Panel title="Currency mix" sub="base-currency revenue composition">
        <BarsChart data={mix.rows as Record<string, number>[]} xKey="month" stacked height={260}
          series={mix.currencies.map((c, i) => ({ key: c, color: CHART.series[i % CHART.series.length] }))} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="New markets entered" sub="first-ever payment from a country, per month">
          <BarsChart data={markets} xKey="month" height={220} series={[{ key: 'newMarkets', name: 'New countries', color: CHART.warn }]} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Billing cadence mix" sub="inferred from inter-payment gaps">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line [&>*]:border-0">
              <KpiCard label="Monthly" value={fmtPct(billing.monthly)} />
              <KpiCard label="Quarterly" value={fmtPct(billing.quarterly)} />
              <KpiCard label="Annual / lump" value={fmtPct(billing.annualOrLump)} />
            </div>
          </Panel>
          <Panel title="T2D3 trajectory" sub="YoY ARR vs the 3·3·2·2·2 benchmark">
            {traj.length ? <DataTable columns={t2d3Cols} rows={traj} />
              : <p className="py-4 font-mono text-xs text-ink-faint">Needs ≥24 months of history.</p>}
          </Panel>
        </div>
      </div>

      <Panel title="Seasonality" sub="calendar-month revenue index (100 = average)">
        {season ? <TrendChart data={season} xKey="calMonth" height={220} series={[{ key: 'index', name: 'Index', color: CHART.accent }]} refLines={[{ y: 100, label: 'avg', color: 'var(--ink-faint)' }]} />
          : <Callout>Needs ≥24 months (2 full years) of history to compute a stable seasonal index.</Callout>}
      </Panel>
    </div>
  )
}
