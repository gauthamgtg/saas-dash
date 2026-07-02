'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, mrrOf, arr as arrOf, arpa, activeCustomers, logoChurnRate,
  nrr, grr, quickRatio, movementSeries, revenueByDimension, topCustomers,
  topNShare, hhi, paretoConcentration, refundRate, refundBridge,
} from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Callout } from '@/src/components/ui/Callout'
import { DataTable } from '@/src/components/ui/DataTable'
import type { Column } from '@/src/components/ui/DataTable'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'
import type { CustomerTotal } from '@/src/lib/engine/segments'

const KGRID = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 lg:grid-cols-6 [&>*]:border-0'
const rel = (cur: number, prev: number) => (prev ? (cur - prev) / prev : null)

/** Diverging-magnitude bar list for the month's revenue movement. */
function MovementPanel({ move }: { move: ReturnType<typeof movementSeries>[number] | undefined }) {
  const rows = move ? [
    { label: 'New', v: move.newMrr, color: CHART.accent },
    { label: 'Expansion', v: move.expansion, color: CHART.steel },
    { label: 'Reactivation', v: move.reactivation, color: CHART.violet },
    { label: 'Contraction', v: -move.contraction, color: CHART.warn },
    { label: 'Churn', v: -move.churn, color: CHART.neg },
  ] : []
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.v)))
  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-paper p-4 shadow-card">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Revenue movement · {move?.month ?? '—'}</h3>
        <span className={`font-mono text-sm font-medium tabular-nums ${!move ? 'text-ink' : move.netNew >= 0 ? 'text-pos' : 'text-neg'}`}>
          {move ? `${move.netNew >= 0 ? '+' : ''}${fmtMoney(move.netNew)}` : '—'}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-20 shrink-0 text-right font-mono text-[11px] text-ink-soft">{r.label}</div>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-paper-2">
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(Math.abs(r.v) / maxAbs) * 100}%`, background: r.color, opacity: 0.85 }} />
            </div>
            <div className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink">{r.v >= 0 ? '+' : '−'}{fmtMoney(Math.abs(r.v))}</div>
          </div>
        ))}
        {!move && <p className="text-center font-mono text-xs text-ink-faint">Need ≥2 months of data</p>}
      </div>
      <p className="mt-3 border-t border-line pt-2 font-mono text-[10px] text-ink-faint">Net new = new + expansion + reactivation − contraction − churn</p>
    </div>
  )
}

/** Compact horizontal share breakdown for a dimension. */
function SharePanel({ title, rows }: { title: string; rows: { key: string; revenue: number; share: number }[] }) {
  const top = rows.slice(0, 6)
  return (
    <div className="rounded-xl border border-line bg-paper p-4 shadow-card">
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">{title}</h3>
      <div className="flex flex-col gap-2.5">
        {top.map((r, i) => (
          <div key={r.key} className="flex items-center gap-3">
            <div className="w-28 shrink-0 truncate text-[13px] text-ink" title={r.key}>{r.key}</div>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-paper-2">
              <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${r.share * 100}%`, background: CHART.series[i % CHART.series.length], opacity: 0.85 }} />
            </div>
            <div className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-soft">{fmtPct(r.share, 0)}</div>
          </div>
        ))}
        {!top.length && <p className="font-mono text-xs text-ink-faint">No data</p>}
      </div>
    </div>
  )
}

export function Briefing() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const months = m.months
    const last = months[months.length - 1] ?? ''
    const prev = months.length > 1 ? months[months.length - 2] : addMonths(last, -1)

    const mrrSeries = months.map((mo) => Math.round(mrrOf(m, mo)))
    const activeSer = months.map((mo) => activeCustomers(m, mo))
    const arpaSer = months.map((mo) => Math.round(arpa(m, mo) ?? 0))
    const move = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    const netNewSer = move.map((x) => Math.round(x.netNew))

    const curMrr = mrrOf(m, last), prevMrr = mrrOf(m, prev)
    const curActive = activeCustomers(m, last), prevActive = activeCustomers(m, prev)
    const curArpa = arpa(m, last), prevArpa = arpa(m, prev)

    return {
      month: last, hasData: months.length > 0,
      mrr: curMrr, arr: arrOf(m, last), arpa: curArpa, active: curActive,
      mrrDelta: rel(curMrr, prevMrr), activeDelta: rel(curActive, prevActive),
      arpaDelta: curArpa != null && prevArpa != null ? rel(curArpa, prevArpa) : null,
      mrrSeries, activeSer, arpaSer, netNewSer,
      mrrChart: months.map((mo, i) => ({ month: mo, MRR: mrrSeries[i] })),
      lastMove: move[move.length - 1],
      nrr: nrr(m, prev, last), grr: grr(m, prev, last),
      quick: quickRatio(move), logoChurn: logoChurnRate(m, prev, last),
      refund: refundRate(txs), net: refundBridge(txs).net,
      region: revenueByDimension(txs, 'region'), model: revenueByDimension(txs, 'businessModel'),
      top: topCustomers(txs, 8), top5: topNShare(txs, 5), hhi: Math.round(hhi(txs)),
      pareto: paretoConcentration(txs),
    }
  }, [txs, state.controls])

  const cols: Column<CustomerTotal>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name ?? r.customerId },
    { key: 'rev', header: 'Revenue', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => fmtPct(r.share) },
  ]

  if (!d.hasData) return (
    <div className="space-y-5">
      <ViewHeader index="00" kicker="Executive Briefing" title="Briefing" />
      <Callout>No rows after the current filters. Widen the date range or clear filters.</Callout>
    </div>
  )

  return (
    <div className="space-y-6">
      <ViewHeader index="00" kicker="Executive Briefing" title="The one-screen picture" sub={`As of ${d.month} · everything below reflects the active filters & controls`} />

      {/* Headline hero KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard hero label="MRR" value={fmtMoney(d.mrr)} delta={d.mrrDelta} spark={d.mrrSeries} sparkColor="var(--accent)" hint="Monthly recurring revenue" />
        <KpiCard hero label="ARR" value={fmtMoney(d.arr)} delta={d.mrrDelta} hint="Annualised run-rate" />
        <KpiCard hero label="Active customers" value={fmtNum(d.active)} delta={d.activeDelta} spark={d.activeSer} sparkColor="var(--steel)" />
        <KpiCard hero label="Net new MRR" value={`${(d.lastMove?.netNew ?? 0) >= 0 ? '+' : ''}${fmtMoney(d.lastMove?.netNew ?? 0)}`}
          tone={(d.lastMove?.netNew ?? 0) >= 0 ? 'pos' : 'neg'} spark={d.netNewSer} sparkColor="var(--accent)" hint={`this month · ${d.month}`} />
      </div>

      {/* Efficiency & retention strip */}
      <div className={KGRID}>
        <KpiCard label="NRR (MoM)" value={fmtPct(d.nrr)} tone={d.nrr != null && d.nrr >= 1 ? 'pos' : 'default'} />
        <KpiCard label="GRR (MoM)" value={fmtPct(d.grr)} />
        <KpiCard label="Quick ratio" value={d.quick == null ? '—' : d.quick.toFixed(2)} />
        <KpiCard label="Logo churn" value={fmtPct(d.logoChurn)} tone={d.logoChurn ? 'neg' : 'default'} />
        <KpiCard label="ARPA" value={fmtMoney(d.arpa)} delta={d.arpaDelta} />
        <KpiCard label="Refund rate" value={fmtPct(d.refund)} tone={d.refund ? 'neg' : 'default'} />
      </div>

      {/* MRR trajectory + movement */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">MRR trajectory</h3>
          <TrendChart data={d.mrrChart} xKey="month" series={[{ key: 'MRR', color: CHART.accent }]} area height={300} />
        </div>
        <MovementPanel move={d.lastMove} />
      </div>

      {/* Where revenue comes from */}
      <div className="grid gap-4 md:grid-cols-2">
        <SharePanel title="Revenue by region" rows={d.region} />
        <SharePanel title="Revenue by business model" rows={d.model} />
      </div>

      {/* Top customers + concentration */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Top customers</h3>
          <DataTable columns={cols} rows={d.top} />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">Concentration</h3>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:border-0">
            <KpiCard label="Top-5 customer share" value={fmtPct(d.top5)} tone={d.top5 > 0.5 ? 'neg' : 'default'} hint="revenue from 5 largest accounts" />
            <KpiCard label="Customer HHI" value={fmtNum(d.hhi)} hint="0–10,000 · >2,500 = concentrated" tone={d.hhi > 2500 ? 'neg' : 'default'} />
            <KpiCard label="Customers → 80% rev" value={fmtPct(d.pareto.customersToEightyPct)} hint="Pareto: share of accounts making 80%" />
          </div>
        </div>
      </div>

      <Callout>
        This briefing rolls up the detail views: <b>Overview</b> (KPIs), <b>Growth</b> (movement), <b>Segments</b> (mix & concentration) and <b>Customers</b>.
        NRR/GRR are month-over-month (prior → latest). Refund rate is a dissatisfaction proxy. Cost-dependent metrics (LTV:CAC, Magic Number, Rule-of-40) are omitted — this dataset carries no spend.
      </Callout>
    </div>
  )
}
