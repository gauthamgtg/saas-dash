'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { DetailDrawer, type Drill } from '@/src/components/ui/DetailDrawer'
import {
  revenueByDimension, hhi, topNShare, gini, paretoConcentration, paretoCurve,
  dominantCurrencyShare, dimensionHhi, newVsRepeatRevenue, buildMatrix,
} from '@/src/lib/engine'
import { DonutChart } from '@/src/components/ui/DonutChart'
import { GeoPanel } from '@/src/components/ui/GeoPanel'
import { ParetoChart } from '@/src/components/ui/ParetoChart'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { fmtPct, fmtNum, fmtMoney } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:border-0'
const tint = (t: number) => `color-mix(in srgb, var(--accent) ${Math.round(t * 88)}%, var(--paper))`

export function Segments() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const [drill, setDrill] = useState<Drill>(null)

  function drillCell(r: string, mo: string) {
    const map = new Map<string, { name: string | null; region: string; model: string; rev: number }>()
    for (const t of txs) {
      const e = map.get(t.customerId) ?? { name: t.name, region: t.region ?? 'Unknown', model: t.businessModel ?? 'Unknown', rev: 0 }
      e.rev += t.amountBase; map.set(t.customerId, e)
    }
    const rows = [...map.entries()].filter(([, e]) => e.region === r && e.model === mo).sort((a, z) => z[1].rev - a[1].rev)
      .map(([id, e]) => ({ name: e.name ?? id, value: fmtMoney(e.rev) }))
    setDrill({ title: `${r} · ${mo}`, subtitle: `${rows.length} accounts`, rows })
  }

  const region = useMemo(() => revenueByDimension(txs, 'region'), [txs])
  const country = useMemo(() => revenueByDimension(txs, 'country'), [txs])
  const model = useMemo(() => revenueByDimension(txs, 'businessModel'), [txs])
  const currency = useMemo(() => revenueByDimension(txs, 'currency'), [txs])
  const pareto = useMemo(() => paretoConcentration(txs), [txs])
  const curve = useMemo(() => paretoCurve(txs), [txs])
  const nvr = useMemo(() => {
    const r = newVsRepeatRevenue(buildMatrix(txs, state.controls.mode))
    const total = r.newRevenue + r.repeatRevenue
    return total ? r.newRevenue / total : null
  }, [txs, state.controls])

  // region × model pivot
  const pivot = useMemo(() => {
    const regions = [...new Set(txs.map((t) => t.region ?? 'Unknown'))].sort()
    const models = [...new Set(txs.map((t) => t.businessModel ?? 'Unknown'))].sort()
    const cell = new Map<string, number>()
    let max = 0
    for (const t of txs) {
      const k = `${t.region ?? 'Unknown'}|${t.businessModel ?? 'Unknown'}`
      const v = (cell.get(k) ?? 0) + t.amountBase
      cell.set(k, v); if (v > max) max = v
    }
    return { regions, models, get: (r: string, mo: string) => cell.get(`${r}|${mo}`) ?? 0, max: max || 1 }
  }, [txs])

  return (
    <div className="space-y-4">
      <ViewHeader index="05" kicker="Breakdown" title="Segments" sub="Where the revenue sits, and how concentrated it is" />

      <div className={KSTRIP}>
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} hint="0–10,000; >2,500 concentrated" tone={hhi(txs) > 2500 ? 'neg' : 'default'} />
        <KpiCard label="Top-5 share" value={fmtPct(topNShare(txs, 5))} tone={topNShare(txs, 5) > 0.5 ? 'neg' : 'default'} />
        <KpiCard label="Revenue Gini" value={gini(txs) == null ? '—' : gini(txs)!.toFixed(3)} hint="0 equal … 1 concentrated" />
        <KpiCard label="Customers → 80%" value={fmtPct(pareto.customersToEightyPct)} hint="fewer = whale-heavy" />
        <KpiCard label="New-revenue share" value={fmtPct(nvr)} hint="vs repeat" />
        <KpiCard label="Dominant currency" value={fmtPct(dominantCurrencyShare(txs))} hint="FX exposure" />
        <KpiCard label="Region HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'region')))} />
        <KpiCard label="Model HHI" value={fmtNum(Math.round(dimensionHhi(txs, 'businessModel')))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Customer concentration" sub="Lorenz curve · bow above the diagonal = concentration risk">
          {curve.length > 1 ? <ParetoChart points={curve} height={280} /> : <p className="py-12 text-center font-mono text-xs text-ink-faint">Not enough customers</p>}
        </Panel>
        <Panel title="Revenue by business model"><DonutChart data={model.map((r) => ({ key: r.key, value: r.revenue }))} centerLabel="Total" height={200} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue by region"><DonutChart data={region.map((r) => ({ key: r.key, value: r.revenue }))} centerLabel="Total" height={190} /></Panel>
        <Panel title="Revenue by country"><GeoPanel rows={country} limit={8} /></Panel>
      </div>

      <Panel title="Region × business model" sub="revenue pivot — colour = intensity · click a cell for accounts">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">Region</th>
                {pivot.models.map((mo) => <th key={mo} className="p-2 text-right font-mono text-[10px] uppercase tracking-wider text-ink-faint">{mo}</th>)}
                <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wider text-ink-soft">Total</th>
              </tr>
            </thead>
            <tbody>
              {pivot.regions.map((r) => {
                const rowTotal = pivot.models.reduce((s, mo) => s + pivot.get(r, mo), 0)
                return (
                  <tr key={r} className="border-t border-line">
                    <td className="p-2 font-medium text-ink">{r}</td>
                    {pivot.models.map((mo) => {
                      const v = pivot.get(r, mo)
                      return <td key={mo} onClick={v > 0 ? () => drillCell(r, mo) : undefined}
                        className={`p-2 text-right font-mono tabular-nums text-ink ${v > 0 ? 'cursor-pointer hover:opacity-80' : ''}`}
                        style={{ background: v > 0 ? tint(v / pivot.max) : 'transparent' }}>{v > 0 ? fmtMoney(v) : '·'}</td>
                    })}
                    <td className="p-2 text-right font-mono tabular-nums text-ink-soft">{fmtMoney(rowTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Callout>HHI on the 0–10,000 scale (&gt;2,500 = concentrated). Lorenz/Gini/Pareto computed on lifetime per-customer revenue.</Callout>

      <DetailDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
