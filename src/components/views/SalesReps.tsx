'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, activeCustomers, movementSeries } from '@/src/lib/engine'
import type { Transaction } from '@/src/lib/types'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { PercentToggle } from '@/src/components/ui/PercentToggle'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { DetailDrawer, type Drill } from '@/src/components/ui/DetailDrawer'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct } from '@/src/lib/format'

const UNATTRIBUTED = 'Unattributed'

type RepRow = {
  rep: string
  mrr: number
  customers: number
  newMrr: number      // last month
  expansion: number
  churn: number
  netNew: number
  spark: number[]     // MRR by month
  lifetime: number    // all-time collected revenue
}

export function SalesReps() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const [drill, setDrill] = useState<Drill>(null)
  const [repPercent, setRepPercent] = useState(true)

  const model = useMemo(() => {
    const byRep = new Map<string, Transaction[]>()
    for (const t of txs) {
      const r = t.salesRep?.trim() || UNATTRIBUTED
      const arr = byRep.get(r) ?? []
      arr.push(t)
      byRep.set(r, arr)
    }
    const global = buildMatrix(txs, state.controls.mode)
    const months = global.months
    const last = months[months.length - 1] ?? ''
    const range: [string, string] | undefined = months.length ? [months[0], last] : undefined

    const rows: RepRow[] = []
    const mrrByRepMonth = new Map<string, Map<string, number>>() // rep -> month -> mrr
    for (const [rep, rtxs] of byRep) {
      const m = buildMatrix(rtxs, state.controls.mode, range)
      const series = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
      const lastMove = series[series.length - 1]
      const spark = months.map((mo) => Math.round(mrrOf(m, mo)))
      mrrByRepMonth.set(rep, new Map(months.map((mo, i) => [mo, spark[i]])))
      rows.push({
        rep,
        mrr: mrrOf(m, last),
        customers: activeCustomers(m, last),
        newMrr: lastMove?.newMrr ?? 0,
        expansion: lastMove?.expansion ?? 0,
        churn: (lastMove?.churn ?? 0) + (lastMove?.contraction ?? 0),
        netNew: lastMove?.netNew ?? 0,
        spark,
        lifetime: rtxs.reduce((s, t) => s + t.amountBase, 0),
      })
    }
    rows.sort((a, b) => b.mrr - a.mrr)
    return { rows, months, last, mrrByRepMonth, totalMrr: mrrOf(global, last) }
  }, [txs, state.controls.mode, state.controls.reactivationGapK])

  const { rows, months, last, mrrByRepMonth, totalMrr } = model
  const named = rows.filter((r) => r.rep !== UNATTRIBUTED)
  const topRep = named[0] ?? rows[0]
  const bestCloser = [...rows].sort((a, b) => (b.newMrr + b.expansion) - (a.newMrr + a.expansion))[0]
  const maxMrr = Math.max(1, ...rows.map((r) => r.mrr))

  // stacked MRR by rep over time — top 8 reps + Other to keep the legend sane
  const chartReps = rows.slice(0, 8).map((r) => r.rep)
  const stacked = months.map((mo) => {
    const row: Record<string, number | string> = { month: mo }
    let other = 0
    for (const r of rows) {
      const v = mrrByRepMonth.get(r.rep)?.get(mo) ?? 0
      if (chartReps.includes(r.rep)) row[r.rep] = v
      else other += v
    }
    if (rows.length > chartReps.length) row.Other = Math.round(other)
    return row
  })
  const stackSeries = [
    ...chartReps.map((rep, i) => ({ key: rep, color: CHART.series[i % CHART.series.length] })),
    ...(rows.length > chartReps.length ? [{ key: 'Other', color: 'var(--ink-faint)' }] : []),
  ]

  function drillRep(rep: string) {
    const accounts = new Map<string, { name: string | null; rev: number }>()
    for (const t of txs) {
      if ((t.salesRep?.trim() || UNATTRIBUTED) !== rep) continue
      const e = accounts.get(t.customerId) ?? { name: t.name, rev: 0 }
      e.rev += t.amountBase
      accounts.set(t.customerId, e)
    }
    const items = [...accounts.entries()].sort((a, b) => b[1].rev - a[1].rev)
    setDrill({
      title: rep, subtitle: `${items.length} accounts · all-time revenue`,
      rows: items.map(([id, e]) => ({ name: e.name ?? id, value: fmtMoney(e.rev), tone: 'default' as const })),
    })
  }

  if (!months.length) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">No data in range</p>

  return (
    <div className="space-y-4">
      <ViewHeader index="04" kicker="Attribution" title="Sales Reps" sub="revenue owned, won and lost per salesperson — latest month movement" />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0">
        <KpiCard label="Reps with revenue" value={String(named.length)} hint={rows.some((r) => r.rep === UNATTRIBUTED) ? '+ unattributed bucket' : undefined} />
        <KpiCard label="Top book of business" value={topRep ? fmtMoney(topRep.mrr) : '—'} hint={topRep?.rep} />
        <KpiCard label="Best closer · this month" value={bestCloser ? fmtMoney(bestCloser.newMrr + bestCloser.expansion) : '—'} hint={bestCloser?.rep} tone="pos" />
        <KpiCard label="Avg MRR per rep" value={named.length ? fmtMoney(named.reduce((s, r) => s + r.mrr, 0) / named.length) : '—'} />
      </div>

      <Panel title="Leaderboard" sub={`book of business as of ${last} · movement is ${last} vs prior month · click a rep for accounts`}
        csv={{ filename: 'sales-reps', rows: rows.map((r) => ({ rep: r.rep, mrr: Math.round(r.mrr), activeCustomers: r.customers, newMrrWon: Math.round(r.newMrr), expansion: Math.round(r.expansion), churnAndContraction: Math.round(r.churn), netNew: Math.round(r.netNew), lifetimeRevenue: Math.round(r.lifetime) })) }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[12px] text-ink-soft font-medium">
                <th className="py-2 pr-3">Rep</th>
                <th className="px-3 py-2 text-right">MRR</th>
                <th className="w-32 px-3 py-2">Share</th>
                <th className="px-3 py-2 text-right">Accounts</th>
                <th className="px-3 py-2 text-right">New won</th>
                <th className="px-3 py-2 text-right">Expansion</th>
                <th className="px-3 py-2 text-right">Churn + contr.</th>
                <th className="px-3 py-2 text-right">Net new</th>
                <th className="px-3 py-2 text-right">Lifetime rev</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.rep} onClick={() => drillRep(r.rep)} className="cursor-pointer border-b border-line transition-colors hover:bg-paper-2">
                  <td className="py-2.5 pr-3">
                    <span className="mr-2 text-[11px] tabular-nums text-ink-faint">#{i + 1}</span>
                    <span className={`font-medium ${r.rep === UNATTRIBUTED ? 'text-ink-faint' : 'text-ink'}`}>{r.rep}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{fmtMoney(r.mrr)}
                    <span className="ml-1 text-[11px] text-ink-faint">{fmtPct(totalMrr ? r.mrr / totalMrr : null)}</span></td>
                  <td className="px-3 py-2.5"><div className="h-1.5 rounded-full bg-line"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.mrr / maxMrr) * 100}%` }} /></div></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink">{r.customers}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: r.newMrr ? 'var(--pos)' : 'var(--ink-faint)' }}>{r.newMrr ? `+${fmtMoney(r.newMrr)}` : '$0'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: r.expansion ? 'var(--pos)' : 'var(--ink-faint)' }}>{r.expansion ? `+${fmtMoney(r.expansion)}` : '$0'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: r.churn ? 'var(--neg)' : 'var(--ink-faint)' }}>{r.churn ? `−${fmtMoney(r.churn)}` : '$0'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: r.netNew > 0 ? 'var(--pos)' : r.netNew < 0 ? 'var(--neg)' : 'var(--ink-faint)' }}>{r.netNew >= 0 ? '+' : '−'}{fmtMoney(Math.abs(r.netNew))}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{fmtMoney(r.lifetime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="MRR by rep over time" sub={repPercent ? 'share of book of business per month' : 'stacked book of business per month'}
        right={<PercentToggle percent={repPercent} onChange={setRepPercent} />}>
        <BarsChart data={stacked} xKey="month" stacked percent={repPercent} height={320} series={stackSeries} />
      </Panel>

      <DetailDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}
