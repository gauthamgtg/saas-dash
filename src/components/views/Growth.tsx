'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, movementSeries, movementEvents, quickRatio, cmgr, nrr, grr, momGrowth } from '@/src/lib/engine'
import type { RevEventType } from '@/src/lib/engine/events'
import { addMonths } from '@/src/lib/types'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { DualAxisChart } from '@/src/components/ui/DualAxisChart'
import { Waterfall } from '@/src/components/ui/Waterfall'
import { Panel } from '@/src/components/ui/Panel'
import { DetailDrawer, type Drill } from '@/src/components/ui/DetailDrawer'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtMoney } from '@/src/lib/format'

const MOVE_TYPES: { type: RevEventType; label: string; color: string }[] = [
  { type: 'new', label: 'New', color: 'var(--pos)' },
  { type: 'expansion', label: 'Expansion', color: 'var(--steel)' },
  { type: 'reactivation', label: 'Reactivation', color: 'var(--violet)' },
  { type: 'contraction', label: 'Contraction', color: 'var(--warn)' },
  { type: 'churn', label: 'Churn', color: 'var(--neg)' },
]

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5 [&>*]:border-0'

export function Growth() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls])
  const [drill, setDrill] = useState<Drill>(null)

  const lastMonth = m.months[m.months.length - 1] ?? ''
  function drillMove(type: RevEventType, label: string) {
    const rows = movementEvents(m, txs, state.controls.reactivationGapK)
      .filter((e) => e.month === lastMonth && e.type === type)
      .map((e) => ({ name: e.name ?? e.customerId, value: `${e.amount >= 0 ? '+' : '−'}${fmtMoney(Math.abs(e.amount))}`, tone: (e.amount >= 0 ? 'pos' : 'neg') as 'pos' | 'neg' }))
    setDrill({ title: `${label} · ${lastMonth}`, subtitle: `${rows.length} accounts`, rows })
  }

  const data = series.map((s) => ({
    month: s.month, New: Math.round(s.newMrr), Expansion: Math.round(s.expansion),
    Reactivation: Math.round(s.reactivation), Contraction: -Math.round(s.contraction),
    Churn: -Math.round(s.churn), 'Net new': Math.round(s.netNew),
  }))
  const netByMonth = new Map(series.map((s) => [s.month, Math.round(s.netNew)]))
  const combo = m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)), 'Net new': netByMonth.get(mo) ?? 0 }))

  const kpis = useMemo(() => {
    const last = m.months[m.months.length - 1] ?? ''
    const prev = addMonths(last, -1)
    return {
      quick: quickRatio(series), cmgr: cmgr(m), mom: momGrowth(m, last), nrr: nrr(m, prev, last), grr: grr(m, prev, last),
      last, opening: mrrOf(m, prev), move: series[series.length - 1],
    }
  }, [m, series])

  return (
    <div className="space-y-4">
      <ViewHeader index="02" kicker="Movement" title="Growth" sub="MRR bridge — expansion & reactivation up, contraction & churn down" />
      <div className={KSTRIP}>
        <KpiCard label="Quick ratio" value={kpis.quick == null ? '—' : kpis.quick.toFixed(2)} hint="inflow ÷ outflow" />
        <KpiCard label="CMGR" value={fmtPct(kpis.cmgr)} hint="compound monthly" />
        <KpiCard label="MoM growth" value={fmtPct(kpis.mom)} tone={kpis.mom != null && kpis.mom < 0 ? 'neg' : 'pos'} />
        <KpiCard label="NRR (MoM)" value={fmtPct(kpis.nrr)} tone={kpis.nrr != null && kpis.nrr >= 1 ? 'pos' : 'default'} />
        <KpiCard label="GRR (MoM)" value={fmtPct(kpis.grr)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRR movement bridge" sub={kpis.move ? `${kpis.move.prevMonth} → ${kpis.last}` : undefined}
          right={kpis.move && <span className="font-mono text-sm font-medium tabular-nums" style={{ color: kpis.move.netNew >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{kpis.move.netNew >= 0 ? '+' : ''}{fmtMoney(kpis.move.netNew)}</span>}>
          {kpis.move
            ? <Waterfall opening={kpis.opening} newMrr={kpis.move.newMrr} expansion={kpis.move.expansion} reactivation={kpis.move.reactivation} contraction={kpis.move.contraction} churn={kpis.move.churn} height={300} />
            : <p className="py-12 text-center font-mono text-xs text-ink-faint">Need ≥2 months</p>}
        </Panel>
        <Panel title="Net new MRR" sub="per month">
          <TrendChart data={data} xKey="month" area height={300} series={[{ key: 'Net new', color: CHART.accent }]} />
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-faint">Drill into {lastMonth}:</span>
        {MOVE_TYPES.map((t) => (
          <button key={t.type} onClick={() => drillMove(t.type, t.label)}
            className="rounded-full border px-3 py-1 font-mono text-[11px] transition-colors hover:bg-paper-2"
            style={{ color: t.color, borderColor: `color-mix(in srgb, ${t.color} 40%, transparent)` }}>{t.label} →</button>
        ))}
      </div>

      <Panel title="Movement components" sub="stacked: gains above zero, losses below">
        <BarsChart data={data} xKey="month" stacked height={320} series={[
          { key: 'New', color: CHART.pos }, { key: 'Expansion', color: '#14b8a6' },
          { key: 'Reactivation', color: CHART.violet }, { key: 'Contraction', color: CHART.warn },
          { key: 'Churn', color: CHART.neg },
        ]} />
      </Panel>

      <Panel title="Net-new vs cumulative MRR" sub="net-new MRR bars (right) behind the cumulative MRR line (left)">
        <DualAxisChart data={combo} xKey="month" height={300}
          leftFmt={(v) => `${Math.round(v / 1000)}k`} rightFmt={(v) => `${Math.round(v / 1000)}k`}
          series={[{ key: 'Net new', color: CHART.steel, axis: 'right', type: 'bar' }, { key: 'MRR', color: CHART.accent, axis: 'left', type: 'line' }]} />
      </Panel>

      <DetailDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
