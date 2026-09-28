'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, mrrOf, arr as arrOf, activeCustomers, logoChurnRate, nrr, grr,
  quickRatio, cmgr, momGrowth, yoyGrowth, movementSeries, arpa, t2d3,
  revenueWeightedChurn, topNShare, hhi, growthPersistence, netNegativeChurn,
  contractionRate, reactivationRate, winBackRate, magicNumber, ruleOf40,
  blendedCac, cacSeries, ltvRevenue, burnMultiple, avgMonthlyNetBurn, runwayMonths,
} from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Panel } from '@/src/components/ui/Panel'
import { Waterfall } from '@/src/components/ui/Waterfall'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 lg:grid-cols-6 [&>*]:border-0'
const ROW = 'flex items-center justify-between border-b border-line py-2 text-sm last:border-0'

export function BoardPack() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    if (!m.months.length) return null
    const last = m.months[m.months.length - 1]
    const prev = m.months.length > 1 ? m.months[m.months.length - 2] : addMonths(last, -1)
    const yearAgo = addMonths(last, -12)
    const series = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    const move = series[series.length - 1]
    const opening = mrrOf(m, prev)
    const gm = state.controls.grossMargin

    const churn = logoChurnRate(m, prev, last)
    const vals: number[] = []
    for (let i = Math.max(1, m.months.length - 12); i < m.months.length; i++) {
      const r = grr(m, m.months[i - 1], m.months[i])
      if (r != null) vals.push(1 - r)
    }
    const avgChurn = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : churn
    const a = arpa(m, last)
    const ltv = a != null && avgChurn != null && avgChurn > 0 ? ltvRevenue(a, gm, avgChurn) : null

    const spend = state.spend
    const cac = spend?.length ? blendedCac(cacSeries(m, spend)) : null
    const magic = spend?.length ? magicNumber(m, spend) : null
    const r40 = spend?.length ? ruleOf40(m, spend) : null
    const burn = spend?.length ? burnMultiple(m, spend) : null
    const netBurn = spend?.length ? avgMonthlyNetBurn(m, spend) : null
    const runway = state.cashOnHand != null && netBurn != null ? runwayMonths(state.cashOnHand, netBurn) : null

    const t2 = t2d3(m)
    const mrrTrend = m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)), ARR: Math.round(mrrOf(m, mo) * 12) }))

    return {
      last, prev,
      mrr: mrrOf(m, last), arr: arrOf(m, last), active: activeCustomers(m, last),
      arpa: a, mom: momGrowth(m, last), yoy: yoyGrowth(m, last), cmgr: cmgr(m),
      nrr: nrr(m, prev, last), nrr12: monthDiffSafe(m.months[0], yearAgo) >= 0 ? nrr(m, yearAgo, last) : null,
      grr: grr(m, prev, last), logoChurn: churn, rwChurn: revenueWeightedChurn(m, prev, last),
      quick: quickRatio(series.slice(-3)), persist: growthPersistence(m),
      nnc: netNegativeChurn(m, prev, last),
      contraction: move ? contractionRate([move], opening) : null,
      reactivation: move ? reactivationRate([move], opening) : null,
      winBack: winBackRate(m),
      top5: topNShare(txs, 5), hhi: hhi(txs),
      move, opening,
      ltv, cac, ltvCac: ltv != null && cac != null && cac > 0 ? ltv / cac : null,
      magic, r40, burn, netBurn, runway, t2, mrrTrend, gm,
      hasSpend: !!spend?.length,
    }
  }, [txs, state.controls, state.spend, state.cashOnHand])

  if (!d) {
    return (
      <div className="space-y-4">
        <ViewHeader index="01" kicker="Board & Diligence" title="Board Pack" />
        <Panel><p className="text-sm text-ink-faint tabular-nums">No rows after filters.</p></Panel>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ViewHeader
        index="01" kicker="Board & Diligence" title="Board Pack"
        sub={`One-screen diligence for ${state.workspace.name} · as of ${d.last} · role: ${state.workspace.role}`}
        actions={
          <button onClick={() => window.print()}
            className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2 hover:text-ink font-medium">
            ⤓ Print pack
          </button>
        }
      />

      <div className={KSTRIP}>
        <KpiCard label="ARR" value={fmtMoneyShort(d.arr)} hint={d.last} />
        <KpiCard label="MRR" value={fmtMoneyShort(d.mrr)} tone={d.mom != null && d.mom < 0 ? 'neg' : 'pos'} hint={fmtPct(d.mom) + ' MoM'} />
        <KpiCard label="YoY growth" value={fmtPct(d.yoy)} hint="needs ≥12 mo" />
        <KpiCard label="NRR (MoM)" value={fmtPct(d.nrr)} tone={d.nrr != null && d.nrr >= 1 ? 'pos' : 'default'} />
        <KpiCard label="Logo churn" value={fmtPct(d.logoChurn)} tone={d.logoChurn != null && d.logoChurn > 0.05 ? 'neg' : 'default'} />
        <KpiCard label="Quick ratio" value={d.quick == null ? '—' : d.quick.toFixed(2)} hint="trailing 3 mo" />
      </div>

      {d.nnc && <Callout tone="pos">Net-negative churn — expansion more than offsets logo/revenue loss this month.</Callout>}
      {!d.hasSpend && (
        <Callout tone="warn">
          Unit-econ and burn metrics need a spend CSV.{' '}
          <button className="underline" onClick={() => dispatch({ type: 'setView', view: 'unitecon' })}>Upload in Unit Economics →</button>
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="ARR bridge" sub={`${d.prev} → ${d.last}`}>
          {d.move
            ? <Waterfall opening={d.opening} newMrr={d.move.newMrr} expansion={d.move.expansion} reactivation={d.move.reactivation} contraction={d.move.contraction} churn={d.move.churn} height={280} />
            : <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need ≥2 months</p>}
        </Panel>
        <Panel title="ARR trajectory" sub="annualized MRR">
          <TrendChart data={d.mrrTrend} xKey="month" area height={280} series={[{ key: 'ARR', color: CHART.accent }]} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Retention & churn">
          <div className="space-y-0">
            <div className={ROW}><span className="text-ink-soft">NRR MoM</span><span className="tabular-nums">{fmtPct(d.nrr)}</span></div>
            <div className={ROW}><span className="text-ink-soft">NRR trailing-12</span><span className="tabular-nums">{fmtPct(d.nrr12)}</span></div>
            <div className={ROW}><span className="text-ink-soft">GRR MoM</span><span className="tabular-nums">{fmtPct(d.grr)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Logo churn</span><span className="tabular-nums">{fmtPct(d.logoChurn)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Rev-weighted churn</span><span className="tabular-nums">{fmtPct(d.rwChurn)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Win-back rate</span><span className="tabular-nums">{fmtPct(d.winBack)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Contraction rate</span><span className="tabular-nums">{fmtPct(d.contraction)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Reactivation rate</span><span className="tabular-nums">{fmtPct(d.reactivation)}</span></div>
          </div>
        </Panel>
        <Panel title="Growth quality">
          <div className="space-y-0">
            <div className={ROW}><span className="text-ink-soft">CMGR</span><span className="tabular-nums">{fmtPct(d.cmgr)}</span></div>
            <div className={ROW}><span className="text-ink-soft">MoM</span><span className="tabular-nums">{fmtPct(d.mom)}</span></div>
            <div className={ROW}><span className="text-ink-soft">YoY</span><span className="tabular-nums">{fmtPct(d.yoy)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Growth persistence</span><span className="tabular-nums">{fmtPct(d.persist)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Active customers</span><span className="tabular-nums">{fmtNum(d.active)}</span></div>
            <div className={ROW}><span className="text-ink-soft">ARPA</span><span className="tabular-nums">{fmtMoney(d.arpa)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Top-5 concentration</span><span className="tabular-nums">{fmtPct(d.top5)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Customer HHI</span><span className="tabular-nums">{Math.round(d.hhi).toLocaleString()}</span></div>
          </div>
        </Panel>
        <Panel title="Efficiency" sub={`GM assumption ${Math.round(d.gm * 100)}%`}>
          <div className="space-y-0">
            <div className={ROW}><span className="text-ink-soft">Blended CAC</span><span className="tabular-nums">{fmtMoney(d.cac)}</span></div>
            <div className={ROW}><span className="text-ink-soft">LTV</span><span className="tabular-nums">{fmtMoney(d.ltv)}</span></div>
            <div className={ROW}><span className="text-ink-soft">LTV:CAC</span><span className="tabular-nums">{d.ltvCac == null ? '—' : `${d.ltvCac.toFixed(1)}×`}</span></div>
            <div className={ROW}><span className="text-ink-soft">Magic Number</span><span className="tabular-nums">{d.magic == null ? '—' : d.magic.toFixed(2)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Rule of 40</span><span className="tabular-nums">{d.r40 == null ? '—' : fmtPct(d.r40.score)}</span></div>
            <div className={ROW}><span className="text-ink-soft">Burn multiple</span><span className="tabular-nums">{d.burn == null ? '—' : !Number.isFinite(d.burn) ? '∞' : `${d.burn.toFixed(1)}×`}</span></div>
            <div className={ROW}><span className="text-ink-soft">Avg net burn / mo</span><span className="tabular-nums">{fmtMoney(d.netBurn)}</span></div>
            <div className={ROW}>
              <span className="text-ink-soft">Runway</span>
              <span className="tabular-nums">
                {d.runway == null ? '—' : !Number.isFinite(d.runway) ? '∞' : `${d.runway.toFixed(0)} mo`}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <span className="text-[12px] text-ink-faint font-medium">Cash on hand</span>
            <input type="number" className="w-28 rounded border border-line-strong bg-paper px-2 py-1 text-[12px] tabular-nums outline-none focus:border-accent"
              placeholder="optional" value={state.cashOnHand ?? ''}
              onChange={(e) => dispatch({ type: 'setCashOnHand', cashOnHand: e.target.value === '' ? null : Number(e.target.value) })} />
          </div>
        </Panel>
      </div>

      {d.t2.length > 0 && (
        <Panel title="T2D3 trajectory" sub="YoY ARR multiples vs 3·3·2·2·2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                  <th className="py-2 pr-4">Year</th><th className="py-2 pr-4">ARR</th><th className="py-2 pr-4">Multiple</th><th className="py-2 pr-4">Target</th><th className="py-2">On track</th>
                </tr>
              </thead>
              <tbody>
                {d.t2.map((r) => (
                  <tr key={r.year} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 tabular-nums">Y{r.year}</td>
                    <td className="py-2 pr-4 tabular-nums">{fmtMoneyShort(r.arr)}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.multiple == null ? '—' : `${r.multiple.toFixed(2)}×`}</td>
                    <td className="py-2 pr-4 tabular-nums">{Number.isNaN(r.target) ? '—' : `${r.target}×`}</td>
                    <td className="py-2 text-[12px] tabular-nums" style={{ color: r.onTrack == null ? 'var(--ink-faint)' : r.onTrack ? 'var(--pos)' : 'var(--neg)' }}>
                      {r.onTrack == null ? '—' : r.onTrack ? 'Yes' : 'Miss'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}

function monthDiffSafe(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return by * 12 + bm - (ay * 12 + am)
}
