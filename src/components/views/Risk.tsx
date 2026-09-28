'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, atRiskRevenue, concentrationTrend, concentrationCovenants,
  currentConcentration, atRiskTrend,
} from '@/src/lib/engine'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Panel } from '@/src/components/ui/Panel'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'

export function Risk() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])

  const d = useMemo(() => {
    if (!m.months.length) return null
    const risk = atRiskRevenue(m, txs, state.controls.atRiskStreak)
    const conc = currentConcentration(txs)
    const covenants = concentrationCovenants(conc.top1, conc.top10, conc.hhi)
    const trend = concentrationTrend(m, 5).map((r) => ({
      month: r.month,
      'Top-5 %': +(r.topShare * 100).toFixed(1),
      HHI: Math.round(r.hhiApprox),
    }))
    const riskTrend = atRiskTrend(m, state.controls.atRiskStreak).map((r) => ({
      month: r.month,
      'At-risk $': Math.round(r.mrr),
      Accounts: r.count,
    }))
    return { risk, conc, covenants, trend, riskTrend }
  }, [m, txs, state.controls.atRiskStreak])

  if (!d) {
    return (
      <div className="space-y-4">
        <ViewHeader index="07" kicker="Risk" title="Risk & Concentration" />
        <Panel><p className="text-sm text-ink-faint tabular-nums">Need data.</p></Panel>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ViewHeader index="07" kicker="Risk" title="Risk & Concentration"
        sub={`At-risk $ ARR · top-N covenants · decline streak ≥ ${state.controls.atRiskStreak} (Assumptions)`} />

      <div className={KSTRIP}>
        <KpiCard label="MRR at risk" value={fmtMoneyShort(d.risk.mrrAtRisk)} tone={d.risk.shareOfMrr > 0.1 ? 'neg' : 'default'} hint={fmtPct(d.risk.shareOfMrr) + ' of MRR'} />
        <KpiCard label="Accounts at risk" value={fmtNum(d.risk.accounts.length)} />
        <KpiCard label="Top-1 share" value={fmtPct(d.conc.top1)} tone={d.conc.top1 > 0.25 ? 'neg' : 'default'} />
        <KpiCard label="Top-10 share" value={fmtPct(d.conc.top10)} tone={d.conc.top10 > 0.5 ? 'neg' : 'default'} />
      </div>

      <Panel title="Concentration covenants">
        <div className="grid gap-2 sm:grid-cols-3">
          {d.covenants.map((c) => (
            <div key={c.id} className="rounded-lg border border-line p-3" style={{ borderColor: c.ok ? undefined : 'color-mix(in srgb, var(--neg) 40%, var(--line))' }}>
              <div className="text-[12px] font-medium" style={{ color: c.ok ? 'var(--pos)' : 'var(--neg)' }}>
                {c.ok ? 'Pass' : 'Breach'}
              </div>
              <div className="mt-1 text-sm font-medium text-ink">{c.label}</div>
              <div className="mt-1 text-[12px] text-ink-soft tabular-nums">
                {c.id === 'hhi' ? Math.round(c.value).toLocaleString() : fmtPct(c.value)}
                {' / limit '}
                {c.id === 'hhi' ? c.limit.toLocaleString() : fmtPct(c.limit)}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top-5 concentration trend" sub="% of MRR">
          <TrendChart data={d.trend} xKey="month" height={260} series={[{ key: 'Top-5 %', color: CHART.warn }]} />
        </Panel>
        <Panel title="At-risk $ trend">
          <TrendChart data={d.riskTrend} xKey="month" height={260} series={[{ key: 'At-risk $', color: CHART.neg }]} />
        </Panel>
      </div>

      <Panel title="At-risk accounts" sub="sorted by exposed MRR">
        {!d.risk.accounts.length ? (
          <Callout tone="pos">No accounts on a decline streak ≥ {state.controls.atRiskStreak}.</Callout>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                  <th className="py-2 pr-4">Account</th><th className="py-2 pr-4">MRR</th><th className="py-2">Streak</th>
                </tr>
              </thead>
              <tbody>
                {d.risk.accounts.slice(0, 40).map((a) => (
                  <tr key={a.customerId} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 font-medium">{a.name}</td>
                    <td className="py-2 pr-4 tabular-nums text-neg">{fmtMoney(a.mrr)}</td>
                    <td className="py-2 tabular-nums">{a.streak} mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
