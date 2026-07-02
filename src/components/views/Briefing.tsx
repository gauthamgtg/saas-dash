'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, mrrOf, arr as arrOf, get, activeCustomers, logoChurnRate,
  nrr, movementSeries, revenueByDimension, movementEvents,
} from '@/src/lib/engine'
import { insights } from '@/src/lib/insights'
import { addMonths } from '@/src/lib/types'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { DonutChart } from '@/src/components/ui/DonutChart'
import { DualAxisChart } from '@/src/components/ui/DualAxisChart'
import { Waterfall } from '@/src/components/ui/Waterfall'
import { ActivityFeed } from '@/src/components/ui/ActivityFeed'
import { GeoPanel } from '@/src/components/ui/GeoPanel'
import { InsightsPanel } from '@/src/components/ui/InsightsPanel'
import { Panel } from '@/src/components/ui/Panel'
import { MiniBar } from '@/src/components/ui/MiniBar'
import { Delta } from '@/src/components/ui/Delta'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'

const rel = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null)

export function Briefing() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const months = m.months
    const last = months[months.length - 1] ?? ''
    const prev = months.length > 1 ? months[months.length - 2] : addMonths(last, -1)
    const nameById = new Map<string, string | null>(), modelById = new Map<string, string>()
    for (const t of txs) { if (!nameById.has(t.customerId)) nameById.set(t.customerId, t.name); if (!modelById.has(t.customerId)) modelById.set(t.customerId, t.businessModel ?? 'Unknown') }

    const mrrSeries = months.map((mo) => Math.round(mrrOf(m, mo)))
    const activeSer = months.map((mo) => activeCustomers(m, mo))
    const netNewSer = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }).map((x) => Math.round(x.netNew))
    const move = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    const lastMove = move[move.length - 1]

    // MRR trend with a year-ago ghost when we have the history
    const mrrChart = months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i], ...(i >= 12 ? { 'MRR · yr ago': mrrSeries[i - 12] } : {}) }))
    const arrChart = months.map((mo, i) => ({ month: mo, ARR: mrrSeries[i] * 12 }))

    // MRR by plan (current month)
    const modelMrr = new Map<string, number>()
    for (const t of txs) if (t.month === last && !t.isRefund) modelMrr.set(t.businessModel ?? 'Unknown', (modelMrr.get(t.businessModel ?? 'Unknown') ?? 0) + t.amountBase)
    const donut = [...modelMrr.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value)

    // Top customers by current MRR
    const top = m.customers.map((c) => ({ customerId: c, name: nameById.get(c) ?? c, model: modelById.get(c) ?? '—', mrr: get(m, c, last), prev: get(m, c, prev) }))
      .filter((r) => r.mrr > 0).sort((a, b) => b.mrr - a.mrr).slice(0, 6)
    const topMax = Math.max(1, ...top.map((t) => t.mrr))

    // Churn & retention trend
    const cr = months.slice(1).map((mo, idx) => {
      const ch = logoChurnRate(m, months[idx], mo) ?? 0
      return { month: mo, Retention: +((1 - ch) * 100).toFixed(1), Churn: +(ch * 100).toFixed(2) }
    })

    const curMrr = mrrOf(m, last), prevMrr = mrrOf(m, prev)
    const curActive = activeCustomers(m, last), prevActive = activeCustomers(m, prev)
    const churn = logoChurnRate(m, prev, last)
    const retention = nrr(m, prev, last)

    return {
      hasData: months.length > 0, month: last, prev,
      mrr: curMrr, arr: arrOf(m, last), totalCustomers: new Set(txs.map((t) => t.customerId)).size, active: curActive,
      churn, retention,
      mrrDelta: rel(curMrr, prevMrr), activeDelta: rel(curActive, prevActive),
      mrrSeries, activeSer, netNewSer, mrrChart, arrChart, donut, top, topMax, cr,
      lastMove, opening: prevMrr,
      geo: revenueByDimension(txs, 'country'),
      events: movementEvents(m, txs, state.controls.reactivationGapK),
      insights: insights(txs, state.controls),
    }
  }, [txs, state.controls])

  if (!d.hasData) return (
    <div className="space-y-5">
      <ViewHeader index="00" kicker="Executive Briefing" title="Briefing" />
      <Panel><p className="font-mono text-sm text-ink-faint">No rows after the current filters. Widen the date range or clear filters.</p></Panel>
    </div>
  )

  return (
    <div className="space-y-4">
      <ViewHeader index="00" kicker="Executive Briefing" title="The one-screen picture" sub={`As of ${d.month} · reflects active filters & controls`} />

      {/* KPI header band */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard hero icon="$" iconColor="var(--accent)" label="MRR" value={fmtMoney(d.mrr)} delta={d.mrrDelta} deltaLabel={`vs ${d.prev}`} spark={d.mrrSeries} />
        <KpiCard hero icon="Σ" iconColor="var(--steel)" label="ARR" value={fmtMoney(d.arr)} delta={d.mrrDelta} deltaLabel="annualised run-rate" />
        <KpiCard hero icon="#" iconColor="var(--violet)" label="Total customers" value={fmtNum(d.totalCustomers)} deltaLabel="all-time distinct" />
        <KpiCard hero icon="◉" iconColor="var(--pos)" label="Active customers" value={fmtNum(d.active)} delta={d.activeDelta} deltaLabel={`vs ${d.prev}`} spark={d.activeSer} sparkColor="var(--steel)" />
        <KpiCard hero icon="↘" iconColor="var(--neg)" label="Logo churn" value={fmtPct(d.churn)} tone={d.churn ? 'neg' : 'default'} deltaLabel="month-over-month" />
        <KpiCard hero icon="⛨" iconColor="var(--pos)" label="Net rev retention" value={fmtPct(d.retention)} tone={d.retention != null && d.retention >= 1 ? 'pos' : 'default'} deltaLabel="MoM" />
      </div>

      {/* Trends + plan split */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="MRR trajectory" sub={d.mrrChart.some((r) => 'MRR · yr ago' in r) ? 'solid = now · dashed = one year ago' : undefined}
          right={<Delta value={d.mrrDelta} />}>
          <TrendChart data={d.mrrChart} xKey="month" area height={260}
            series={[{ key: 'MRR', color: CHART.accent }, ...(d.mrrChart.some((r) => 'MRR · yr ago' in r) ? [{ key: 'MRR · yr ago', color: CHART.ink, ghost: true }] : [])]} />
        </Panel>
        <Panel title="MRR by plan" sub={`as of ${d.month}`}>
          <DonutChart data={d.donut} centerLabel="Total MRR" height={200} />
        </Panel>
      </div>

      {/* Movement waterfall + top customers + churn/retention */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="MRR movement" sub={`${d.prev} → ${d.month}`}
          right={<span className="font-mono text-sm font-medium tabular-nums" style={{ color: (d.lastMove?.netNew ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{(d.lastMove?.netNew ?? 0) >= 0 ? '+' : ''}{fmtMoney(d.lastMove?.netNew ?? 0)}</span>}>
          {d.lastMove
            ? <Waterfall opening={d.opening} newMrr={d.lastMove.newMrr} expansion={d.lastMove.expansion} reactivation={d.lastMove.reactivation} contraction={d.lastMove.contraction} churn={d.lastMove.churn} height={260} />
            : <p className="py-10 text-center font-mono text-xs text-ink-faint">Need ≥2 months</p>}
        </Panel>
        <Panel title="Top customers by MRR">
          <table className="w-full text-sm">
            <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Plan</th>
              <th className="pb-2 text-right font-medium">MRR</th><th className="pb-2 text-right font-medium">Δ</th></tr></thead>
            <tbody>
              {d.top.map((t) => (
                <tr key={t.customerId} className="border-t border-line">
                  <td className="py-1.5 pr-2"><div className="flex items-center gap-2"><MiniBar value={t.mrr} max={d.topMax} width={26} /><span className="truncate">{t.name}</span></div></td>
                  <td className="py-1.5 pr-2 text-ink-soft">{t.model}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{fmtMoney(t.mrr)}</td>
                  <td className="py-1.5 text-right">{t.prev > 0 ? <Delta value={rel(t.mrr, t.prev)} /> : <span className="font-mono text-[11px] text-pos">new</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Churn & retention" sub="logo, month-over-month">
          <DualAxisChart data={d.cr} xKey="month" height={240}
            leftFmt={(v) => `${v}%`} rightFmt={(v) => `${v}%`}
            series={[{ key: 'Retention', color: CHART.pos, axis: 'left' }, { key: 'Churn', color: CHART.neg, axis: 'right' }]} />
        </Panel>
      </div>

      {/* Activity + geo + insights */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Recent activity" sub="individual revenue movements"><ActivityFeed events={d.events} limit={9} /></Panel>
        <Panel title="Revenue by country"><GeoPanel rows={d.geo} limit={7} /></Panel>
        <Panel title="Insights" sub="auto-generated"><InsightsPanel items={d.insights} /></Panel>
      </div>
    </div>
  )
}
