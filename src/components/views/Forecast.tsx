'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, cmgr, mrrForecast, scenarioForecast, momGrowth, bottomUpForecast, pipelineCoverage, arr } from '@/src/lib/engine'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { ForecastChart } from '@/src/components/ui/ForecastChart'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-5 [&>*]:border-0'
const NUM = 'w-20 rounded border border-line-strong bg-paper px-2 py-1 text-[12px] tabular-nums outline-none focus:border-accent'

export function Forecast() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const [ahead, setAhead] = useState(12)
  const [bearPct, setBearPct] = useState(-1)
  const [basePct, setBasePct] = useState(3)
  const [bullPct, setBullPct] = useState(6)

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    if (!m.months.length) return null
    const last = m.months[m.months.length - 1]
    const baseMrr = mrrOf(m, last)
    const g = cmgr(m)
    const mom = momGrowth(m, last)
    const auto = mrrForecast(m, ahead, 6)
    const scenarios = scenarioForecast(baseMrr, last, {
      bear: bearPct / 100, base: basePct / 100, bull: bullPct / 100,
    }, ahead)
    const hist = m.months.map((mo) => ({ month: mo, Actual: Math.round(mrrOf(m, mo)), MRR: Math.round(mrrOf(m, mo)) }))
    const combined = [
      ...hist.map((r) => ({ month: r.month, Actual: r.Actual })),
      ...scenarios.map((s) => ({ month: s.month, Bear: s.bear, Base: s.base, Bull: s.bull })),
    ]
    const deals = state.pipeline ?? []
    const bottomUp = bottomUpForecast(m, deals, ahead)
    const buCombined = [
      ...hist.map((r) => ({ month: r.month, Actual: r.Actual })),
      ...bottomUp.map((s) => ({ month: s.month, BottomUp: s.total, Retained: s.retained, Pipeline: s.pipelineNew })),
    ]
    const coverage = pipelineCoverage(deals, arr(m, last))
    return {
      last, baseMrr, g, mom, auto, scenarios, combined, observed: hist,
      arr12: scenarios.length ? scenarios[scenarios.length - 1].base * 12 : null,
      bottomUp, buCombined, coverage, hasPipeline: deals.length > 0,
    }
  }, [txs, state.controls.mode, state.pipeline, ahead, bearPct, basePct, bullPct])

  if (!d) {
    return (
      <div className="space-y-4">
        <ViewHeader index="03" kicker="Planning" title="Forecast" />
        <Panel><p className="text-sm text-ink-faint tabular-nums">Need revenue history to project.</p></Panel>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ViewHeader index="03" kicker="Planning" title="Forecast"
        sub="Trailing-CMGR cone plus editable bear / base / bull scenarios — planning aid, not a promise" />

      <Callout tone="neutral">
        These are run-rate extrapolations from payment history. They ignore pipeline, seasonality shocks, and price changes unless you set scenario rates below.
      </Callout>

      <div className={KSTRIP}>
        <KpiCard label="Current MRR" value={fmtMoneyShort(d.baseMrr)} hint={d.last} />
        <KpiCard label="CMGR" value={fmtPct(d.g)} hint="historical compound" />
        <KpiCard label="Last MoM" value={fmtPct(d.mom)} />
        <KpiCard label={`Base ARR @ +${ahead}mo`} value={fmtMoneyShort(d.arr12)} hint={`${basePct}% / mo`} />
        <KpiCard label="Pipeline coverage" value={d.coverage == null ? '—' : `${d.coverage.toFixed(1)}×`} hint="weighted ÷ current ARR" />
      </div>

      <Panel title="Scenario assumptions" sub="monthly growth rates">
        <div className="flex flex-wrap items-end gap-6">
          <label className="flex flex-col gap-1"><span className="text-[12px] text-ink-faint font-medium">Bear % / mo</span>
            <input type="number" step={0.5} className={NUM} value={bearPct} onChange={(e) => setBearPct(Number(e.target.value))} /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] text-ink-faint font-medium">Base % / mo</span>
            <input type="number" step={0.5} className={NUM} value={basePct} onChange={(e) => setBasePct(Number(e.target.value))} /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] text-ink-faint font-medium">Bull % / mo</span>
            <input type="number" step={0.5} className={NUM} value={bullPct} onChange={(e) => setBullPct(Number(e.target.value))} /></label>
          <label className="flex flex-col gap-1"><span className="text-[12px] text-ink-faint font-medium">Horizon (mo)</span>
            <input type="number" min={3} max={36} step={1} className={NUM} value={ahead} onChange={(e) => setAhead(Math.min(36, Math.max(3, Number(e.target.value) || 12)))} /></label>
          {d.g != null && (
            <button onClick={() => { const p = +(d.g! * 100).toFixed(2); setBasePct(p); setBearPct(+(p - 2).toFixed(2)); setBullPct(+(p + 2).toFixed(2)) }}
              className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2 font-medium">
              Seed from CMGR
            </button>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="CMGR uncertainty cone" sub="± ~3% / month widening band">
          {d.auto.length
            ? <ForecastChart observed={d.observed} forecast={d.auto} height={300} />
            : <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need ≥2 months of positive MRR</p>}
        </Panel>
        <Panel title="Bear · Base · Bull" sub={`${ahead}-month scenario paths`}>
          <TrendChart data={d.combined} xKey="month" height={300} series={[
            { key: 'Actual', color: CHART.accent },
            { key: 'Bear', color: CHART.neg },
            { key: 'Base', color: CHART.steel },
            { key: 'Bull', color: CHART.pos },
          ]} />
        </Panel>
      </div>

      <Panel title="Bottom-up (retention × pipeline)" sub={d.hasPipeline ? 'NRR on base + weighted open pipeline as new MRR' : 'Upload Pipeline CSV to include deals'}>
        {d.hasPipeline ? (
          <TrendChart data={d.buCombined} xKey="month" height={280} series={[
            { key: 'Actual', color: CHART.accent },
            { key: 'BottomUp', color: CHART.steel },
            { key: 'Retained', color: CHART.pos },
            { key: 'Pipeline', color: CHART.violet },
          ]} />
        ) : (
          <p className="py-8 text-center text-sm text-ink-soft">No pipeline deals yet — scenario / CMGR paths still apply above.</p>
        )}
      </Panel>

      <Panel title="Scenario table">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Bear MRR</th>
                <th className="py-2 pr-4">Base MRR</th>
                <th className="py-2 pr-4">Bull MRR</th>
                <th className="py-2">Base ARR</th>
              </tr>
            </thead>
            <tbody>
              {d.scenarios.map((s) => (
                <tr key={s.month} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 tabular-nums">{s.month}</td>
                  <td className="py-2 pr-4 tabular-nums text-neg">{fmtMoney(s.bear)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(s.base)}</td>
                  <td className="py-2 pr-4 tabular-nums text-pos">{fmtMoney(s.bull)}</td>
                  <td className="py-2 tabular-nums">{fmtMoneyShort(s.base * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
