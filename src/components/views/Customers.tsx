'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, topCustomers, atRisk, perCustomerRefundRate, recencyDays, get, movementEvents } from '@/src/lib/engine'
import { Panel } from '@/src/components/ui/Panel'
import { MiniBar } from '@/src/components/ui/MiniBar'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { Delta } from '@/src/components/ui/Delta'
import { ActivityFeed } from '@/src/components/ui/ActivityFeed'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4 [&>*]:border-0'
const rel = (a: number, b: number) => (b ? (a - b) / b : null)
const badge = (color: string, label: string) => (
  <span className="rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{label}</span>
)

export function Customers() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const asOf = useMemo(() => new Date(Math.max(...txs.map((t) => t.date.getTime()), 0)), [txs])

  const { rows, revMax, events } = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const months = m.months
    const last = months[months.length - 1] ?? '', prev = months[months.length - 2] ?? ''
    const rows = topCustomers(txs, 25).map((t) => {
      const recency = recencyDays(txs, t.customerId, asOf)
      return {
        customerId: t.customerId, name: t.name, revenue: t.revenue, share: t.share,
        spark: months.map((mo) => Math.round(get(m, t.customerId, mo))),
        mrr: get(m, t.customerId, last), delta: rel(get(m, t.customerId, last), get(m, t.customerId, prev)),
        atRisk: atRisk(m, t.customerId, state.controls.atRiskStreak),
        refundRate: perCustomerRefundRate(txs, t.customerId),
        recency, dormant: recency != null && recency > state.controls.dormancyDays,
      }
    })
    const revMax = Math.max(1, ...rows.map((r) => r.revenue))
    return { rows, revMax, events: movementEvents(m, txs, state.controls.reactivationGapK) }
  }, [txs, state.controls, asOf])

  const dormantCount = rows.filter((r) => r.dormant).length
  const atRiskCount = rows.filter((r) => r.atRisk).length

  return (
    <div className="space-y-4">
      <ViewHeader index="06" kicker="Accounts" title="Customers" sub="Top 25 by revenue, with trend, churn-risk & engagement signals" />
      <div className={KSTRIP}>
        <KpiCard label="Shown" value={fmtNum(rows.length)} />
        <KpiCard label="At-risk" value={fmtNum(atRiskCount)} tone={atRiskCount ? 'neg' : 'default'} hint={`≥${state.controls.atRiskStreak} declining months`} />
        <KpiCard label="Dormant" value={fmtNum(dormantCount)} tone={dormantCount ? 'neg' : 'default'} hint={`>${state.controls.dormancyDays}d since payment`} />
        <KpiCard label="Total revenue" value={fmtMoney(rows.reduce((s, r) => s + r.revenue, 0))} hint="top 25" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Revenue leaderboard" bodyClass="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="pb-2 font-medium">Customer</th><th className="pb-2 text-right font-medium">Revenue</th>
              <th className="pb-2 text-right font-medium">Share</th><th className="pb-2 text-center font-medium">Trend</th>
              <th className="pb-2 text-right font-medium">Δ MoM</th><th className="pb-2 text-right font-medium">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId} className="border-t border-line">
                  <td className="py-2 pr-2"><div className="flex items-center gap-2"><MiniBar value={r.revenue} max={revMax} width={30} /><span className="truncate">{r.name ?? r.customerId}</span></div></td>
                  <td className="py-2 text-right font-mono tabular-nums">{fmtMoney(r.revenue)}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-ink-soft">{fmtPct(r.share)}</td>
                  <td className="py-2"><div className="flex justify-center"><Sparkline data={r.spark} w={72} h={22} color={r.delta != null && r.delta < 0 ? 'var(--neg)' : 'var(--accent)'} /></div></td>
                  <td className="py-2 text-right">{r.mrr > 0 ? <Delta value={r.delta} /> : <span className="font-mono text-[11px] text-ink-faint">—</span>}</td>
                  <td className="py-2 text-right">
                    {r.atRisk ? badge('var(--neg)', 'at risk') : r.dormant ? badge('var(--warn)', 'dormant') : badge('var(--pos)', 'ok')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Recent activity" sub="individual movements"><ActivityFeed events={events} limit={14} /></Panel>
      </div>
    </div>
  )
}
