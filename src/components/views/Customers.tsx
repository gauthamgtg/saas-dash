'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, topCustomers, atRisk, perCustomerRefundRate, recencyDays, get, movementEvents, isOrganicSource } from '@/src/lib/engine'
import { Panel } from '@/src/components/ui/Panel'
import { MiniBar } from '@/src/components/ui/MiniBar'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { Delta } from '@/src/components/ui/Delta'
import { ActivityFeed } from '@/src/components/ui/ActivityFeed'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { AccountProfile } from '@/src/components/ui/AccountProfile'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'
import { CHART } from '@/src/lib/theme'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const rel = (a: number, b: number) => (b ? (a - b) / b : null)
const badge = (color: string, label: string) => (
  <span className="rounded px-2 py-0.5 text-[12px] font-medium" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{label}</span>
)

export function Customers() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const [open, setOpen] = useState<string | null>(null)
  const asOf = useMemo(() => new Date(Math.max(...txs.map((t) => t.date.getTime()), 0)), [txs])

  const { rows, revMax, events, sources, sourceTotal } = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    const months = m.months
    const last = months[months.length - 1] ?? '', prev = months[months.length - 2] ?? ''
    const sourceOf = new Map<string, string>()
    for (const t of txs) if (t.source && !sourceOf.has(t.customerId)) sourceOf.set(t.customerId, t.source)
    // per acquisition source: how many came in, how many stayed, and what they pay now
    const bySrc = new Map<string, { source: string; acquired: number; active: number; mrr: number }>()
    for (const c of m.customers) {
      const src = sourceOf.get(c)
      if (!src) continue
      const r = bySrc.get(src) ?? { source: src, acquired: 0, active: 0, mrr: 0 }
      const v = get(m, c, last)
      r.acquired++; if (v > 0) { r.active++; r.mrr += v }
      bySrc.set(src, r)
    }
    const sources = [...bySrc.values()].sort((a, b) => b.mrr - a.mrr)
    const sourceTotal = sources.reduce((s, r) => s + r.mrr, 0)
    const rows = topCustomers(txs, 25).map((t) => {
      const recency = recencyDays(txs, t.customerId, asOf)
      return {
        customerId: t.customerId, name: t.name, source: sourceOf.get(t.customerId) ?? null, revenue: t.revenue, share: t.share,
        spark: months.map((mo) => Math.round(get(m, t.customerId, mo))),
        mrr: get(m, t.customerId, last), delta: rel(get(m, t.customerId, last), get(m, t.customerId, prev)),
        atRisk: atRisk(m, t.customerId, state.controls.atRiskStreak),
        refundRate: perCustomerRefundRate(txs, t.customerId),
        recency, dormant: recency != null && recency > state.controls.dormancyDays,
      }
    })
    const revMax = Math.max(1, ...rows.map((r) => r.revenue))
    return { rows, revMax, sources, sourceTotal, events: movementEvents(m, txs, state.controls.reactivationGapK) }
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

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel className="min-w-0 lg:col-span-2" title="Revenue leaderboard" sub="Click an account for its full profile" bodyClass="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[12px] text-ink-faint font-medium">
              <th className="pb-2 font-medium">Customer</th><th className="pb-2 text-right font-medium">Revenue</th>
              <th className="pb-2 text-right font-medium">Share</th><th className="pb-2 text-center font-medium">Trend</th>
              <th className="pb-2 text-right font-medium">Δ MoM</th><th className="pb-2 text-right font-medium">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerId} onClick={() => setOpen(r.customerId)} title="Open account profile" className="cursor-pointer border-t border-line transition-colors hover:bg-paper-2">
                  <td className="py-2 pr-2"><div className="flex items-center gap-2"><MiniBar value={r.revenue} max={revMax} width={30} /><span className="min-w-0"><span className="block truncate">{r.name ?? r.customerId}</span>{r.source && <span className="block truncate text-[11px] text-ink-faint">{r.source}</span>}</span></div></td>
                  <td className="py-2 text-right tabular-nums">{fmtMoney(r.revenue)}</td>
                  <td className="py-2 text-right tabular-nums text-ink-soft">{fmtPct(r.share)}</td>
                  <td className="py-2"><div className="flex justify-center"><Sparkline data={r.spark} w={72} h={22} color={r.delta != null && r.delta < 0 ? 'var(--neg)' : 'var(--accent)'} /></div></td>
                  <td className="py-2 text-right">{r.mrr > 0 ? <Delta value={r.delta} /> : <span className="text-[11px] text-ink-faint tabular-nums">—</span>}</td>
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
      {sources.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="min-w-0 lg:col-span-2" title="Acquisition source" sub="Where accounts came from, how many are still paying, and what they bring in now" bodyClass="overflow-x-auto"
            csv={{ filename: 'acquisition-sources', rows: sources.map((r) => ({ source: r.source, type: isOrganicSource(r.source) ? 'organic' : 'paid', acquired: r.acquired, active: r.active, mrr: Math.round(r.mrr) })) }}>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[12px] text-ink-faint font-medium">
                <th className="pb-2 font-medium">Source</th><th className="pb-2 text-right font-medium">Acquired</th>
                <th className="pb-2 text-right font-medium">Retained</th><th className="pb-2 text-right font-medium">MRR</th>
                <th className="pb-2 pl-4 font-medium">Share of MRR</th><th className="pb-2 text-right font-medium">ARPA</th></tr></thead>
              <tbody>
                {sources.map((r, i) => (
                  <tr key={r.source} className="border-t border-line">
                    <td className="py-2 pr-2"><div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CHART.series[i % CHART.series.length] }} />
                      <span className="truncate">{r.source}</span>
                      {isOrganicSource(r.source) ? badge('var(--pos)', 'organic') : badge('var(--steel)', 'paid')}
                    </div></td>
                    <td className="py-2 text-right tabular-nums">{fmtNum(r.acquired)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-soft">{fmtPct(r.active / r.acquired)}</td>
                    <td className="py-2 text-right tabular-nums">{fmtMoney(r.mrr)}</td>
                    <td className="py-2 pl-4"><div className="flex items-center gap-2">
                      <MiniBar value={r.mrr} max={sources[0].mrr} width={72} color={CHART.series[i % CHART.series.length]} />
                      <span className="text-[12px] tabular-nums text-ink-soft">{fmtPct(sourceTotal ? r.mrr / sourceTotal : 0)}</span>
                    </div></td>
                    <td className="py-2 text-right tabular-nums">{r.active ? fmtMoney(r.mrr / r.active) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Paid vs organic" sub="current MRR by acquisition type">
            <div className="mb-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
              {sources.map((r, i) => r.mrr > 0 && (
                <div key={r.source} title={`${r.source}: ${fmtPct(r.mrr / sourceTotal)}`} style={{ width: `${(r.mrr / sourceTotal) * 100}%`, background: CHART.series[i % CHART.series.length] }} />
              ))}
            </div>
            {(['paid', 'organic'] as const).map((kind) => {
              const g = sources.filter((r) => isOrganicSource(r.source) === (kind === 'organic'))
              const acquired = g.reduce((s, r) => s + r.acquired, 0), active = g.reduce((s, r) => s + r.active, 0), mrr = g.reduce((s, r) => s + r.mrr, 0)
              return (
                <div key={kind} className="border-t border-line py-3.5 first-of-type:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    {badge(kind === 'organic' ? 'var(--pos)' : 'var(--steel)', kind)}
                    <span className="text-[12px] tabular-nums text-ink-faint">{fmtPct(sourceTotal ? mrr / sourceTotal : 0)} of MRR</span>
                  </div>
                  <div className="mt-2 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{fmtMoney(mrr)}</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11.5px] text-ink-faint">
                    <span><b className="block text-[13px] font-medium tabular-nums text-ink">{fmtNum(acquired)}</b>acquired</span>
                    <span><b className="block text-[13px] font-medium tabular-nums text-ink">{acquired ? fmtPct(active / acquired) : '—'}</b>retained</span>
                    <span><b className="block text-[13px] font-medium tabular-nums text-ink">{active ? fmtMoney(mrr / active) : '—'}</b>ARPA</span>
                  </div>
                </div>
              )
            })}
          </Panel>
        </div>
      ) : (
        <Panel title="Acquisition source"><p className="text-sm text-ink-faint">Map an <b className="font-medium text-ink-soft">Acquisition Source</b> column on upload (e.g. lead_source, utm_source) to see where accounts come from.</p></Panel>
      )}
      <AccountProfile customerId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
