'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, cacByChannel, cohortCacPayback, salesEfficiency, paidVsOrganicCac,
  expansionLtvSummary, ruleOf40Trend, burnMultiple,
} from '@/src/lib/engine'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Panel } from '@/src/components/ui/Panel'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-3 lg:grid-cols-6 [&>*]:border-0'

export function EfficiencyLab() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const spend = state.spend
  const gm = state.controls.grossMargin

  const d = useMemo(() => {
    if (!spend?.length || !m.months.length) return null
    const channels = cacByChannel(m, spend)
    const cohorts = cohortCacPayback(m, spend, gm)
    const ltv = expansionLtvSummary(m, gm)
    const paidOrg = paidVsOrganicCac(m, spend)
    const se = salesEfficiency(m, spend, 3)
    const r40 = ruleOf40Trend(m, spend)
    const burn = burnMultiple(m, spend)
    return {
      channels,
      cohorts,
      ltv,
      paidOrg,
      se,
      burn,
      r40Chart: r40.filter((r) => r.score != null).map((r) => ({
        month: r.month,
        'Rule of 40': +((r.score ?? 0) * 100).toFixed(1),
        Growth: +((r.growth ?? 0) * 100).toFixed(1),
        Margin: +((r.margin ?? 0) * 100).toFixed(1),
      })),
      channelBars: channels.slice(0, 10).map((c) => ({ channel: c.channel, CAC: c.cac == null ? 0 : Math.round(c.cac) })),
    }
  }, [m, spend, gm])

  if (!spend?.length) {
    return (
      <div className="space-y-4">
        <ViewHeader index="09" kicker="Efficiency" title="Efficiency Lab"
          sub="Channel CAC, cohort payback, expansion LTV, sales efficiency, Rule of 40 trend" />
        <Callout tone="warn">
          Upload a spend CSV in{' '}
          <button className="underline" onClick={() => dispatch({ type: 'setView', view: 'unitecon' })}>Unit Economics</button>
          {' '}(include channel + category). Then return here.
        </Callout>
      </div>
    )
  }

  if (!d) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">No data in range</p>

  return (
    <div className="space-y-4">
      <ViewHeader index="09" kicker="Efficiency" title="Efficiency Lab"
        sub={`GM ${fmtPct(gm)} · channel & cohort CAC · expansion-adjusted LTV`} />

      <div className={KSTRIP}>
        <KpiCard label="Sales efficiency" value={d.se == null ? '—' : d.se.toFixed(2)} hint="net new ARR / S&M (3mo)" />
        <KpiCard label="Burn multiple" value={d.burn == null ? '—' : !Number.isFinite(d.burn) ? '∞' : `${d.burn.toFixed(1)}×`} />
        <KpiCard label="Classic LTV" value={fmtMoneyShort(d.ltv.classicLtv)} />
        <KpiCard label="Expansion LTV" value={fmtMoneyShort(d.ltv.expansionLtv)} hint="NRR-lifted" tone="pos" />
        <KpiCard label="Paid CAC (proxy)" value={fmtMoney(d.paidOrg.paidCac)} />
        <KpiCard label="Organic CAC (proxy)" value={fmtMoney(d.paidOrg.organicCac)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="CAC by channel" sub="S&M allocated by channel share × new logos">
          <BarsChart data={d.channelBars} xKey="channel" horizontal height={Math.max(200, d.channelBars.length * 32)}
            series={[{ key: 'CAC', color: CHART.accent }]} />
        </Panel>
        <Panel title="Rule of 40 trend" sub="needs 12+ months + spend">
          {d.r40Chart.length
            ? <TrendChart data={d.r40Chart} xKey="month" height={280} series={[
              { key: 'Rule of 40', color: CHART.accent },
              { key: 'Growth', color: CHART.pos },
              { key: 'Margin', color: CHART.steel },
            ]} />
            : <p className="py-12 text-center text-xs text-ink-faint tabular-nums">Need 12 months of overlapping spend</p>}
        </Panel>
      </div>

      <Panel title="Cohort CAC payback" sub="S&M in acquisition month ÷ first-month GP">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Cohort</th><th className="py-2 pr-4">New</th><th className="py-2 pr-4">S&M</th>
                <th className="py-2 pr-4">CAC</th><th className="py-2 pr-4">First ARPA</th><th className="py-2">Payback</th>
              </tr>
            </thead>
            <tbody>
              {d.cohorts.slice(-18).map((r) => (
                <tr key={r.cohortMonth} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 tabular-nums">{r.cohortMonth}</td>
                  <td className="py-2 pr-4 tabular-nums">{r.newCustomers}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(r.smSpend)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(r.cac)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(r.firstMonthArpa)}</td>
                  <td className="py-2 tabular-nums" style={{ color: r.paybackMonths != null && r.paybackMonths > 12 ? 'var(--neg)' : 'var(--pos)' }}>
                    {r.paybackMonths == null ? '—' : `${r.paybackMonths.toFixed(1)} mo`}
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
