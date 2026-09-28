'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { useAnnotations } from '@/src/state/annotations'
import { applyFilters, overviewModel } from '@/src/lib/dashboard'
import {
  buildMatrix, get, mrrOf, arpa, nrr, grr, quickRatio, movementSeries, movementEvents, logoChurnRate,
  refundBridge, refundRate, invoiceStats, activeCustomers, mrrForecast, timelineMarkers,
  revenueByDimension,
} from '@/src/lib/engine'
import { addMonths, COMPARE_OFFSET, COMPARE_LABEL } from '@/src/lib/types'
import { insights } from '@/src/lib/insights'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { DualAxisChart } from '@/src/components/ui/DualAxisChart'
import { DonutChart } from '@/src/components/ui/DonutChart'
import { ForecastChart } from '@/src/components/ui/ForecastChart'
import { RefundBridge } from '@/src/components/ui/RefundBridge'
import { Panel } from '@/src/components/ui/Panel'
import { MiniBar } from '@/src/components/ui/MiniBar'
import { Delta } from '@/src/components/ui/Delta'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { InsightsPanel } from '@/src/components/ui/InsightsPanel'
import { ActivityFeed } from '@/src/components/ui/ActivityFeed'
import { DetailDrawer, type Drill } from '@/src/components/ui/DetailDrawer'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const ROW = 'flex items-center justify-between border-b border-line py-2 text-sm last:border-0'
const rel = (a: number, b: number) => (b ? (a - b) / b : null)

/** Colored initial chip — stands in for the customer logos of the reference design. */
function Avatar({ name }: { name: string }) {
  const c = CHART.series[Math.abs([...name].reduce((s, ch) => s + ch.charCodeAt(0), 0)) % CHART.series.length]
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[12px] font-semibold text-white" style={{ background: c }}>
      {name.slice(0, 1)}
    </span>
  )
}

/** Tiny net-new MRR bar strip (green up / red down), reference "MRR Breakdown" footer. */
function NetNewBars({ series }: { series: { netNew: number }[] }) {
  const vals = series.map((s) => s.netNew)
  const max = Math.max(1, ...vals.map(Math.abs))
  const w = 6, gap = 3, h = 36, mid = h / 2
  return (
    <svg width={vals.length * (w + gap)} height={h} aria-hidden className="max-w-full">
      {vals.map((v, i) => {
        const bh = Math.max(2, (Math.abs(v) / max) * (mid - 2))
        return <rect key={i} x={i * (w + gap)} y={v >= 0 ? mid - bh : mid} width={w} height={bh} rx={1.5}
          fill={v >= 0 ? CHART.pos : CHART.neg} opacity={0.85} />
      })}
    </svg>
  )
}

export function Overview() {
  const { state } = useApp()
  const { notes, add, clear } = useAnnotations()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
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
    const off = COMPARE_OFFSET[state.controls.comparePeriod]
    const ghostKey = `MRR · ${COMPARE_LABEL[state.controls.comparePeriod]}`
    const mrrChart = months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i], ...(off && i >= off ? { [ghostKey]: mrrSeries[i - off] } : {}) }))
    const hasGhost = off > 0 && mrrChart.some((r) => ghostKey in r)
    const arrChart = months.map((mo, i) => ({ month: mo, ARR: mrrSeries[i] * 12 }))

    // cumulative distinct customers (reference "Total Customers" + delta)
    const firstMonth = new Map<string, string>()
    for (const t of txs) { const f = firstMonth.get(t.customerId); if (!f || t.month < f) firstMonth.set(t.customerId, t.month) }
    const totalToDate = (mo: string) => [...firstMonth.values()].filter((f) => f <= mo).length
    const totalCustomers = totalToDate(last), totalPrev = totalToDate(prev)

    // churn & retention trend (MoM, per month)
    const churnRet = months.slice(1).map((mo, i) => ({
      month: mo,
      'Churn %': +(((logoChurnRate(m, months[i], mo) ?? 0) * 100).toFixed(2)),
      'Retention %': +(((grr(m, months[i], mo) ?? 0) * 100).toFixed(2)),
    }))

    // MRR by plan (latest month), revenue by country (range), movement breakdown
    const lastTxs = txs.filter((t) => t.month === last)
    const planDim = lastTxs.some((t) => t.plan) ? 'plan' as const : 'businessModel' as const
    const plan = revenueByDimension(lastTxs, planDim).map((r) => ({ key: r.key, value: Math.round(r.revenue) }))
    const geoDim = txs.some((t) => t.country) ? 'country' as const : 'region' as const
    const geo = revenueByDimension(txs, geoDim).slice(0, 6)
    const geoTotal = geo.reduce((s, g) => s + g.revenue, 0)

    const moves = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    const lastMove = moves[moves.length - 1]
    const prevMove = moves[moves.length - 2]

    // top customers by current MRR, with MoM change
    const top = [...m.customers]
      .map((c) => ({ id: c, mrr: get(m, c, last), prev: get(m, c, prev) }))
      .filter((r) => r.mrr > 0).sort((a, b) => b.mrr - a.mrr).slice(0, 5)
      .map((r) => ({ ...r, name: txs.find((t) => t.customerId === r.id)?.name ?? r.id, change: rel(r.mrr, r.prev) }))

    const events = movementEvents(m, txs, state.controls.reactivationGapK)

    const names = new Map<string, string>()
    for (const t of txs) if (t.name && !names.has(t.customerId)) names.set(t.customerId, t.name)

    return {
      matrix: m, months, names,
      last, prev, mrrChart, hasGhost, ghostKey, arrChart, plan, geo, geoDim, geoTotal, moves, lastMove, prevMove, top, events,
      churnRet, totalCustomers, totalDelta: rel(totalCustomers, totalPrev),
      mrrObserved: months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i] })),
      forecast: mrrForecast(m, 6), markers: timelineMarkers(m, state.controls.reactivationGapK),
      mrrDelta: rel(mrrOf(m, last), mrrOf(m, prev)), activeDelta: rel(activeCustomers(m, last), activeCustomers(m, prev)),
      nrr: nrr(m, prev, last), grr: grr(m, prev, last), quick: quickRatio(moves),
      bridge: refundBridge(txs), refund: refundRate(txs), inv: invoiceStats(txs),
      insights: insights(txs, state.controls),
    }
  }, [txs, state.controls])

  const [drill, setDrill] = useState<Drill>(null)
  const nameOf = (id: string) => d.names.get(id) ?? id

  /** Chart month click → every account behind that month's MRR, with MoM movement. */
  function drillMonth(mo: string) {
    const idx = d.months.indexOf(mo)
    if (idx < 0) return
    const prevMo = idx > 0 ? d.months[idx - 1] : null
    const rows = d.matrix.customers
      .map((c) => ({ c, cur: get(d.matrix, c, mo), was: prevMo ? get(d.matrix, c, prevMo) : 0 }))
      .filter((r) => r.cur !== 0 || r.was !== 0)
      .sort((a, b) => b.cur - a.cur)
      .map((r) => ({
        name: nameOf(r.c), value: fmtMoney(r.cur),
        sub: prevMo ? `${fmtMoney(r.was)} → Δ ${fmtMoney(r.cur - r.was)}` : undefined,
        tone: (r.cur > r.was ? 'pos' : r.cur < r.was ? 'neg' : 'default') as 'pos' | 'neg' | 'default',
      }))
    setDrill({ title: mo, subtitle: `MRR ${fmtMoney(Math.round(mrrOf(d.matrix, mo)))} · account movement`, rows })
  }

  /** Customer click → their month-by-month MRR history. */
  function drillCustomer(id: string) {
    const rows = d.months
      .map((mo) => ({ mo, v: get(d.matrix, id, mo) }))
      .filter((r) => r.v !== 0)
      .map((r) => ({ name: r.mo, value: fmtMoney(r.v) }))
    setDrill({ title: nameOf(id), subtitle: `${id} · monthly MRR history`, rows })
  }

  const vs = d.prev ? `vs ${d.prev}` : undefined
  const moveRow = (label: string, cur: number | undefined, prevV: number | undefined, invert = false) => (
    <div className={ROW}>
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-center gap-2.5">
        <span className={`text-[13px] font-medium tabular-nums ${cur != null && cur < 0 ? 'text-neg' : 'text-ink'}`}>{cur == null ? '—' : fmtMoney(cur)}</span>
        <Delta value={cur != null && prevV ? rel(Math.abs(cur), Math.abs(prevV)) : null} invert={invert} />
      </span>
    </div>
  )

  return (
    <div className="space-y-4">
      <ViewHeader index="01" kicker="Snapshot" title="Overview" sub={model.month ? `Track your revenue performance · as of ${model.month}` : 'No data'} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard hero icon="$" iconColor="var(--accent)" label="MRR" value={fmtMoney(model.mrr)} delta={d.mrrDelta} deltaLabel={vs} />
        <KpiCard hero icon="Σ" iconColor="var(--pos)" label="ARR" value={fmtMoneyShort(model.arr)} delta={d.mrrDelta} deltaLabel={vs} />
        <KpiCard hero icon="◉" iconColor="var(--violet)" label="Total customers" value={fmtNum(d.totalCustomers)} delta={d.totalDelta} deltaLabel="all-time distinct" />
        <KpiCard hero icon="✓" iconColor="var(--warn)" label="Active customers" value={fmtNum(model.activeCustomers)} delta={d.activeDelta} deltaLabel={vs} />
        <KpiCard hero icon="↘" iconColor="var(--neg)" label="Churn rate" value={fmtPct(model.logoChurn)} tone={model.logoChurn ? 'neg' : 'default'} deltaLabel="logo churn · MoM" />
        <KpiCard hero icon="⛨" iconColor="var(--steel)" label="Retention rate" value={fmtPct(d.grr)} tone={d.grr != null && d.grr >= 0.95 ? 'pos' : 'default'} deltaLabel="gross revenue · MoM" />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="MRR trend" sub={`${d.hasGhost ? `solid = now · dashed = ${d.ghostKey.replace('MRR · ', '')} · ` : ''}click a month to drill in`}
          csv={{ filename: 'mrr-trend', rows: d.mrrChart }}
          right={<div className="flex items-center gap-2">
            {notes.length > 0 && <button onClick={clear} className="text-[12px] text-ink-faint hover:text-neg font-medium">clear notes</button>}
            <button onClick={addNote} className="rounded-md border border-line-strong px-2 py-0.5 text-[12px] text-ink-soft hover:bg-paper-2 hover:text-ink font-medium">＋ note</button>
          </div>}>
          <TrendChart data={d.mrrChart} xKey="month" area height={250} markers={[...d.markers, ...notes]} onPointClick={drillMonth}
            series={[{ key: 'MRR', color: CHART.accent }, ...(d.hasGhost ? [{ key: d.ghostKey, color: CHART.ink, ghost: true }] : [])]} />
        </Panel>
        <Panel title="MRR by plan" sub={`as of ${d.last}`} csv={{ filename: 'mrr-by-plan', rows: d.plan }}>
          <DonutChart data={d.plan} centerLabel="Total MRR" height={150} />
          <div className="mt-4 border-t border-line pt-3">
            <div className="mb-1.5 text-[12px] text-ink-soft font-medium">ARR trend</div>
            <TrendChart data={d.arrChart} xKey="month" area height={110} series={[{ key: 'ARR', color: CHART.pos }]} />
          </div>
        </Panel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="MRR breakdown" sub={`${d.prev} → ${d.last}`} csv={{ filename: 'mrr-movement', rows: d.moves }}>
          {moveRow('New MRR', d.lastMove?.newMrr, d.prevMove?.newMrr)}
          {moveRow('Expansion MRR', d.lastMove?.expansion, d.prevMove?.expansion)}
          {moveRow('Reactivation', d.lastMove?.reactivation, d.prevMove?.reactivation)}
          {moveRow('Contraction MRR', d.lastMove ? -d.lastMove.contraction || 0 : undefined, d.prevMove?.contraction, true)}
          {moveRow('Churned MRR', d.lastMove ? -d.lastMove.churn || 0 : undefined, d.prevMove?.churn, true)}
          <div className="mt-1 flex items-center justify-between pt-2">
            <span className="text-sm font-semibold text-ink">Net new MRR</span>
            <span className={`text-[15px] font-semibold tabular-nums ${d.lastMove && d.lastMove.netNew < 0 ? 'text-neg' : 'text-pos'}`}>
              {d.lastMove ? fmtMoney(d.lastMove.netNew) : '—'}
            </span>
          </div>
          <div className="mt-2">{d.moves.length > 1 && <NetNewBars series={d.moves} />}</div>
        </Panel>

        <Panel title="Top customers by MRR" sub="click a customer for full history"
          csv={{ filename: 'top-customers', rows: d.top.map((c) => ({ customer: c.name, id: c.id, mrr: c.mrr, prevMrr: c.prev })) }}>
          <div className="mb-1 flex justify-between border-b border-line pb-1.5 text-[11px] text-ink-faint font-medium">
            <span>Customer</span><span>MRR · change</span>
          </div>
          {d.top.map((c) => (
            <div key={c.id} role="button" tabIndex={0} onClick={() => drillCustomer(c.id)}
              onKeyDown={(e) => e.key === 'Enter' && drillCustomer(c.id)}
              className={`${ROW} -mx-1.5 cursor-pointer rounded-md px-1.5 transition-colors hover:bg-paper-2`}>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={c.name} />
                <span className="truncate text-ink">{c.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="text-[13px] font-medium tabular-nums text-ink">{fmtMoney(c.mrr)}</span>
                <Delta value={c.change} />
              </span>
            </div>
          ))}
          {!d.top.length && <p className="py-8 text-center text-xs text-ink-faint tabular-nums">No active customers</p>}
        </Panel>

        <Panel title="Churn & retention trend" sub="logo churn vs gross retention · MoM" csv={{ filename: 'churn-retention', rows: d.churnRet }}>
          {d.churnRet.length > 1 ? (
            <DualAxisChart data={d.churnRet} xKey="month" height={228}
              leftFmt={(v) => `${v}%`} rightFmt={(v) => `${v}%`}
              series={[
                { key: 'Retention %', color: CHART.steel, axis: 'left' },
                { key: 'Churn %', color: CHART.neg, axis: 'right' },
              ]} />
          ) : <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need 2+ months of history</p>}
        </Panel>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Recent activity" sub="individual revenue movements · new, expansion, churn & more"
          csv={{ filename: 'recent-activity', rows: d.events.slice(0, 20).map((e) => ({ customer: e.name ?? e.customerId, type: e.type, month: e.month, amount: e.amount })) }}>
          <ActivityFeed events={d.events} limit={6} />
        </Panel>

        <Panel title={d.geoDim === 'country' ? 'Revenue by country' : 'Revenue by region'} sub="share of range revenue"
          csv={{ filename: `revenue-by-${d.geoDim}`, rows: d.geo.map((g) => ({ [d.geoDim]: g.key, revenue: Math.round(g.revenue), share: +(g.share * 100).toFixed(1) })) }}>
          {d.geo.map((g) => (
            <div key={g.key} className={ROW}>
              <span className="min-w-0 truncate text-ink">{g.key}</span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="text-[13px] tabular-nums text-ink">{fmtMoneyShort(g.revenue)}</span>
                <MiniBar value={g.revenue} max={d.geoTotal} width={64} color="var(--steel)" />
                <span className="w-11 text-right text-[11px] tabular-nums text-ink-faint">{fmtPct(g.share, 1)}</span>
              </span>
            </div>
          ))}
          {!d.geo.length && <p className="py-8 text-center text-xs text-ink-faint tabular-nums">No geography columns mapped</p>}
        </Panel>

        <Panel title="Insights" sub="auto-generated from your data">
          <InsightsPanel items={d.insights} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRR forecast" sub="modeled — trailing CMGR run-rate, ±uncertainty cone">
          {d.forecast.length ? <ForecastChart observed={d.mrrObserved} forecast={d.forecast} height={250} />
            : <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need more history to project</p>}
        </Panel>
        <Panel title="Gross → net revenue" sub="lifetime bookings after refunds">
          <RefundBridge gross={d.bridge.gross} refunded={d.bridge.refunded} net={d.bridge.net} height={250} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 text-[12.5px] text-ink-soft font-medium">Bookings & efficiency</h2>
        <div className={KSTRIP}>
          <KpiCard label="Net revenue" value={fmtMoney(d.bridge.net)} hint={`gross ${fmtMoney(d.bridge.gross)} − refunds ${fmtMoney(d.bridge.refunded)}`} />
          <KpiCard label="Net revenue retention" value={fmtPct(d.nrr)} tone={d.nrr != null && d.nrr >= 1 ? 'pos' : 'default'} hint="benchmark ≥ 100%" />
          <KpiCard label="Quick ratio" value={d.quick == null ? '—' : d.quick.toFixed(2)} hint="healthy ≥ 4" tone={d.quick != null && d.quick >= 4 ? 'pos' : 'default'} />
          <KpiCard label="Avg invoice value" value={fmtMoney(d.inv.avgInvoiceValue)} hint={`${fmtNum(d.inv.distinctInvoices)} distinct invoices`} />
        </div>
      </div>

      <Callout>
        NRR/GRR shown month-over-month (prior → latest). Benchmarks are common SaaS reference points, not peer-calibrated.
        Cost-dependent metrics live in Unit Economics (upload spend) and the Board Pack.
      </Callout>

      <DetailDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
