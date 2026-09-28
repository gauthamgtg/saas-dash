'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, mrrOf, movementSeries, expansionRate, contractionRate, reactivationRate,
  avgRetentionCurves, earlyLifeChurn, timeToChurnMonths, winBackByCohort,
  churnSplitByDimension, movementMix, movementMixSeries, winBackRate, netNegativeChurn,
} from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Panel } from '@/src/components/ui/Panel'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { CHART } from '@/src/lib/theme'
import { fmtPct, fmtNum, fmtMoney } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 lg:grid-cols-6 [&>*]:border-0'

export function RetentionLab() {
  const { state } = useApp()
  const [dim, setDim] = useState<'plan' | 'region' | 'businessModel'>('plan')
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls.reactivationGapK])

  const d = useMemo(() => {
    if (!m.months.length) return null
    const last = m.months[m.months.length - 1]
    const prev = m.months.length > 1 ? m.months[m.months.length - 2] : addMonths(last, -1)
    const opening = mrrOf(m, prev)
    const curves = avgRetentionCurves(m, 12).map((r) => ({
      age: `M${r.age}`,
      Gross: r.gross == null ? undefined : +(r.gross * 100).toFixed(1),
      Net: r.net == null ? undefined : +(r.net * 100).toFixed(1),
      Logo: r.logo == null ? undefined : +(r.logo * 100).toFixed(1),
    }))
    const mix = movementMix(series)
    const mixSer = movementMixSeries(series).map((x) => ({
      month: x.month,
      New: +(x.newShare * 100).toFixed(1),
      Expansion: +(x.expansionShare * 100).toFixed(1),
      Reactivation: +(x.reactivationShare * 100).toFixed(1),
    }))
    const early = earlyLifeChurn(m, 3)
    const split = churnSplitByDimension(m, txs, dim, prev, last)
    return {
      last,
      expansion: expansionRate(series, opening),
      contraction: contractionRate(series, opening),
      reactivation: reactivationRate(series, opening),
      ttc: timeToChurnMonths(m),
      winBack: winBackRate(m),
      nnc: netNegativeChurn(m, prev, last),
      curves, mix, mixSer, early,
      winByCohort: winBackByCohort(m),
      split,
    }
  }, [m, series, txs, dim])

  if (!d) {
    return (
      <div className="space-y-4">
        <ViewHeader index="06" kicker="Retention" title="Retention Lab" />
        <Panel><p className="text-sm text-ink-faint tabular-nums">Need revenue history.</p></Panel>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ViewHeader index="06" kicker="Retention" title="Retention Lab"
        sub="Gross vs net curves, early-life churn, win-backs, expansion rates, logo vs $ by segment" />

      <div className={KSTRIP}>
        <KpiCard label="Expansion rate" value={fmtPct(d.expansion)} hint="exp ÷ opening MRR" tone="pos" />
        <KpiCard label="Contraction rate" value={fmtPct(d.contraction)} hint="contraction ÷ opening" tone="neg" />
        <KpiCard label="Reactivation rate" value={fmtPct(d.reactivation)} />
        <KpiCard label="Median time-to-churn" value={d.ttc == null ? '—' : `${d.ttc.toFixed(1)} mo`} />
        <KpiCard label="Win-back rate" value={fmtPct(d.winBack)} />
        <KpiCard label="Net-neg churn" value={d.nnc ? 'Yes' : d.nnc == null ? '—' : 'No'} tone={d.nnc ? 'pos' : 'default'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Avg retention curves" sub="% of starting cohort · by age">
          <TrendChart data={d.curves} xKey="age" height={280} series={[
            { key: 'Gross', color: CHART.steel },
            { key: 'Net', color: CHART.accent },
            { key: 'Logo', color: CHART.violet },
          ]} />
        </Panel>
        <Panel title="Inflow mix over time" sub="% of monthly inflow">
          <BarsChart data={d.mixSer} xKey="month" stacked height={280} series={[
            { key: 'New', color: CHART.pos },
            { key: 'Expansion', color: CHART.accent },
            { key: 'Reactivation', color: CHART.violet },
          ]} />
        </Panel>
      </div>

      {d.mix && (
        <Panel title={`Movement mix · ${d.mix.month}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] text-ink-faint font-medium">Inflow {fmtMoney(d.mix.inflow.total)}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>New</span><span className="tabular-nums">{fmtPct(d.mix.shares.new)} · {fmtMoney(d.mix.inflow.new)}</span></div>
                <div className="flex justify-between"><span>Expansion</span><span className="tabular-nums">{fmtPct(d.mix.shares.expansion)} · {fmtMoney(d.mix.inflow.expansion)}</span></div>
                <div className="flex justify-between"><span>Reactivation</span><span className="tabular-nums">{fmtPct(d.mix.shares.reactivation)} · {fmtMoney(d.mix.inflow.reactivation)}</span></div>
              </div>
            </div>
            <div>
              <div className="mb-2 text-[12px] text-ink-faint font-medium">Outflow {fmtMoney(d.mix.outflow.total)}</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>Contraction</span><span className="tabular-nums">{fmtPct(d.mix.shares.contraction)} · {fmtMoney(d.mix.outflow.contraction)}</span></div>
                <div className="flex justify-between"><span>Churn</span><span className="tabular-nums">{fmtPct(d.mix.shares.churn)} · {fmtMoney(d.mix.outflow.churn)}</span></div>
              </div>
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Early-life logo churn (0–3 mo)" sub="cohorts old enough to measure">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Cohort</th><th className="py-2 pr-4">Size</th><th className="py-2 pr-4">Lost</th><th className="py-2">Rate</th>
              </tr>
            </thead>
            <tbody>
              {d.early.slice(-12).map((r) => (
                <tr key={r.cohortMonth} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 tabular-nums">{r.cohortMonth}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtNum(r.size)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtNum(r.lost)}</td>
                  <td className="py-2 tabular-nums" style={{ color: r.rate > 0.25 ? 'var(--neg)' : undefined }}>{fmtPct(r.rate)}</td>
                </tr>
              ))}
              {!d.early.length && <tr><td colSpan={4} className="py-6 text-center text-xs text-ink-faint tabular-nums">Need cohorts ≥3 months old</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Win-back by cohort">
        <BarsChart
          data={d.winByCohort.slice(-18).map((r) => ({ month: r.cohortMonth, Rate: +(r.rate * 100).toFixed(1) }))}
          xKey="month" height={240} series={[{ key: 'Rate', color: CHART.accent }]}
        />
      </Panel>

      <Panel title="Logo vs revenue-weighted churn" sub={`by ${dim}`}
        right={
          <div className="flex gap-1">
            {(['plan', 'region', 'businessModel'] as const).map((k) => (
              <button key={k} onClick={() => setDim(k)}
                className={`rounded-md border px-2 py-0.5 text-[12px] ${dim === k ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-soft'} font-medium`}>
                {k === 'businessModel' ? 'model' : k}
              </button>
            ))}
          </div>
        }>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Segment</th><th className="py-2 pr-4">Logos</th><th className="py-2 pr-4">Opening MRR</th>
                <th className="py-2 pr-4">Logo churn</th><th className="py-2">Rev-weighted</th>
              </tr>
            </thead>
            <tbody>
              {d.split.slice(0, 15).map((r) => (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.key}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtNum(r.logos)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(r.openingMrr)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtPct(r.logoChurn)}</td>
                  <td className="py-2 tabular-nums" style={{ color: (r.revenueChurn ?? 0) > (r.logoChurn ?? 0) * 1.3 ? 'var(--neg)' : undefined }}>
                    {fmtPct(r.revenueChurn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
