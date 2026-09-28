'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, activeCustomers, movementSeries, arpa, get } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import type { Movement } from '@/src/lib/engine/movement'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct } from '@/src/lib/format'

const BREAKOUT_ROWS: { key: keyof Movement; label: string; sign: 1 | -1 }[] = [
  { key: 'newMrr', label: 'New', sign: 1 },
  { key: 'expansion', label: 'Expansion', sign: 1 },
  { key: 'reactivation', label: 'Reactivation', sign: 1 },
  { key: 'contraction', label: 'Contraction', sign: -1 },
  { key: 'churn', label: 'Churn', sign: -1 },
  { key: 'netNew', label: 'Change', sign: 1 },
]

function MoneyCell({ v }: { v: number }) {
  const r = Math.round(v)
  if (r === 0) return <span className="text-ink-faint">$0</span>
  return <span style={{ color: r > 0 ? 'var(--pos)' : 'var(--neg)' }}>{r > 0 ? '' : '−'}{fmtMoney(Math.abs(r))}</span>
}

export function Mrr() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls.reactivationGapK])

  const last = m.months[m.months.length - 1] ?? ''
  const first = m.months[0] ?? ''
  const cur = mrrOf(m, last)
  const startMrr = mrrOf(m, first)
  const periodChange = startMrr > 0 ? cur / startMrr - 1 : null

  const mrrData = m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)) }))
  const breakoutMonths = m.months.slice(-9)
  const moveByMonth = new Map(series.map((s) => [s.month, s]))

  // historical comparison strip, Baremetrics-style
  const compares = [1, 3, 6, 12, 24]
    .map((k) => ({ k, month: addMonths(last, -k) }))
    .filter((c) => m.months.includes(c.month))
    .map((c) => {
      const v = mrrOf(m, c.month)
      return { label: `${c.k} month${c.k > 1 ? 's' : ''} ago`, value: v, delta: v > 0 ? cur / v - 1 : null }
    })

  const growthData = series.map((s) => ({
    month: s.month, New: Math.round(s.newMrr), Expansion: Math.round(s.expansion),
    Reactivation: Math.round(s.reactivation), Contraction: -Math.round(s.contraction), Churn: -Math.round(s.churn),
  }))

  // Plans: each customer's latest plan + current-month MRR
  const plans = useMemo(() => {
    const planOf = new Map<string, string>()
    const latest = new Map<string, Date>()
    for (const t of txs) {
      if (!latest.has(t.customerId) || t.date > latest.get(t.customerId)!) {
        latest.set(t.customerId, t.date)
        planOf.set(t.customerId, t.plan ?? 'No plan')
      }
    }
    const agg = new Map<string, { customers: number; mrr: number }>()
    for (const c of m.customers) {
      const v = get(m, c, last)
      if (v === 0) continue
      const p = planOf.get(c) ?? 'No plan'
      const e = agg.get(p) ?? { customers: 0, mrr: 0 }
      e.customers++; e.mrr += v
      agg.set(p, e)
    }
    return [...agg.entries()].map(([plan, e]) => ({ plan, ...e })).sort((a, b) => b.mrr - a.mrr)
  }, [txs, m, last])
  const totalCustomers = plans.reduce((s, p) => s + p.customers, 0)
  const maxPlanMrr = Math.max(1, ...plans.map((p) => p.mrr))

  if (!m.months.length) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">No data in range</p>

  return (
    <div className="space-y-4">
      <ViewHeader index="03" kicker="Recurring" title="Monthly Recurring Revenue" sub={`${first} → ${last} · ${activeCustomers(m, last)} active customers · ARPU ${fmtMoney(arpa(m, last))}`} />

      <Panel>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] text-ink-soft font-medium">MRR · {last}</div>
            <div className="mt-1 text-[2.6rem] font-semibold leading-none tabular-nums tracking-tight text-ink">{fmtMoney(cur)}</div>
            {periodChange != null && (
              <div className="mt-2 text-[12px]" style={{ color: periodChange >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {periodChange >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(periodChange))} <span className="text-ink-faint">in selected period</span>
              </div>
            )}
          </div>
        </div>
        <TrendChart data={mrrData} xKey="month" area height={280} series={[{ key: 'MRR', color: CHART.accent }]} />

        {series.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse whitespace-nowrap text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-line-strong text-left">
                  <th className="py-2 pr-3 text-[12px] text-ink-soft font-medium">Breakout</th>
                  {breakoutMonths.map((mo) => (
                    <th key={mo} className="px-3 py-2 text-right text-[12px] text-ink-soft font-medium">{mo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BREAKOUT_ROWS.map((r) => (
                  <tr key={r.key} className={`border-b border-line ${r.key === 'netNew' ? 'bg-paper-2' : ''}`}>
                    <td className="py-2 pr-3 font-medium text-ink">{r.label}</td>
                    {breakoutMonths.map((mo) => {
                      const mv = moveByMonth.get(mo)
                      const v = mv ? (mv[r.key] as number) * r.sign : 0
                      return <td key={mo} className="px-3 py-2 text-right"><MoneyCell v={v} /></td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {compares.length > 0 && (
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card [&>*]:border-0" style={{ gridTemplateColumns: `repeat(${compares.length + 1}, minmax(0, 1fr))` }}>
          <div className="bg-paper p-4 text-center">
            <div className="text-[12px] text-ink-soft font-medium">Current</div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums text-ink">{fmtMoney(cur)}</div>
          </div>
          {compares.map((c) => (
            <div key={c.label} className="bg-paper p-4 text-center">
              <div className="text-[12px] text-ink-soft font-medium">{c.label}</div>
              <div className="mt-1.5 text-xl font-semibold tabular-nums text-ink">{fmtMoney(c.value)}</div>
              {c.delta != null && (
                <div className="mt-1 text-[11px] tabular-nums" style={{ color: c.delta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {c.delta >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(c.delta))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Panel title="Monthly growth" sub="gains above zero, losses below — new, expansion & reactivation vs contraction & churn">
        <BarsChart data={growthData} xKey="month" stacked height={300} series={[
          { key: 'New', color: CHART.pos }, { key: 'Expansion', color: '#14b8a6' },
          { key: 'Reactivation', color: CHART.violet }, { key: 'Contraction', color: CHART.warn },
          { key: 'Churn', color: CHART.neg },
        ]} />
      </Panel>

      <Panel title="Plans" sub={`current MRR by pricing plan · ${last}`}
        csv={{ filename: 'plans-mrr', rows: plans.map((p) => ({ plan: p.plan, activeCustomers: p.customers, mrr: Math.round(p.mrr) })) }}>
        {plans.length === 1 && plans[0].plan === 'No plan' ? (
          <p className="py-8 text-center text-xs text-ink-faint tabular-nums">Map a “Plan” column on upload to see per-plan MRR</p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[12px] text-ink-soft font-medium">
                <th className="py-2 pr-3">Plan</th>
                <th className="px-3 py-2 text-right">Active customers</th>
                <th className="w-28 px-3 py-2" />
                <th className="px-3 py-2 text-right">MRR</th>
                <th className="w-28 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.plan} className="border-b border-line">
                  <td className="py-2.5 pr-3 font-medium text-ink">{p.plan}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {p.customers} <span className="text-[11px] text-ink-faint">{fmtPct(totalCustomers ? p.customers / totalCustomers : null)}</span>
                  </td>
                  <td className="px-3 py-2.5"><div className="h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full" style={{ width: `${(p.customers / Math.max(1, totalCustomers)) * 100}%`, background: CHART.steel }} /></div></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">
                    {fmtMoney(p.mrr)} <span className="text-[11px] text-ink-faint">{fmtPct(cur ? p.mrr / cur : null)}</span>
                  </td>
                  <td className="px-3 py-2.5"><div className="h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${(p.mrr / maxPlanMrr) * 100}%` }} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
