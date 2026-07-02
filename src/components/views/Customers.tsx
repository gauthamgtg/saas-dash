'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, topCustomers, atRisk, perCustomerRefundRate, recencyDays } from '@/src/lib/engine'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'

type Row = {
  customerId: string; name: string | null; revenue: number; share: number
  atRisk: boolean; refundRate: number | null; recency: number | null; dormant: boolean
}

export function Customers() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const asOf = useMemo(() => new Date(Math.max(...txs.map((t) => t.date.getTime()), 0)), [txs])

  const rows = useMemo<Row[]>(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return topCustomers(txs, 25).map((t) => {
      const recency = recencyDays(txs, t.customerId, asOf)
      return {
        customerId: t.customerId, name: t.name, revenue: t.revenue, share: t.share,
        atRisk: atRisk(m, t.customerId, state.controls.atRiskStreak),
        refundRate: perCustomerRefundRate(txs, t.customerId),
        recency, dormant: recency != null && recency > state.controls.dormancyDays,
      }
    })
  }, [txs, state.controls, asOf])

  const dormantCount = rows.filter((r) => r.dormant).length
  const atRiskCount = rows.filter((r) => r.atRisk).length

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name ?? r.customerId },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => fmtPct(r.share) },
    { key: 'refund', header: 'Refund rate', align: 'right', render: (r) => fmtPct(r.refundRate) },
    { key: 'recency', header: 'Recency', align: 'right', render: (r) => (r.recency == null ? '—' : `${r.recency}d`) },
    {
      key: 'flag', header: 'Status', render: (r) =>
        r.atRisk ? <span className="bg-neg/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-neg">at risk</span>
          : r.dormant ? <span className="bg-warn/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-warn">dormant</span>
            : <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">ok</span>,
    },
  ]

  return (
    <div className="space-y-5">
      <ViewHeader index="05" kicker="Accounts" title="Customers" sub="Top 25 by revenue, with churn-risk & engagement signals" />
      <div className="grid grid-cols-3 gap-px border border-line bg-line [&>*]:border-0">
        <KpiCard label="Shown" value={fmtNum(rows.length)} />
        <KpiCard label="At-risk" value={fmtNum(atRiskCount)} tone={atRiskCount ? 'neg' : 'default'} hint={`≥${state.controls.atRiskStreak} declining months`} />
        <KpiCard label="Dormant" value={fmtNum(dormantCount)} tone={dormantCount ? 'neg' : 'default'} hint={`>${state.controls.dormancyDays}d since payment`} />
      </div>
      <DataTable columns={cols} rows={rows} />
    </div>
  )
}
