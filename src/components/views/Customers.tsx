'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, topCustomers, atRisk, perCustomerRefundRate } from '@/src/lib/engine'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { fmtMoney, fmtPct } from '@/src/lib/format'

type Row = { customerId: string; name: string | null; revenue: number; share: number; atRisk: boolean; refundRate: number | null }

export function Customers() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const rows = useMemo<Row[]>(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return topCustomers(txs, 25).map((t) => ({
      customerId: t.customerId, name: t.name, revenue: t.revenue, share: t.share,
      atRisk: atRisk(m, t.customerId, state.controls.atRiskStreak),
      refundRate: perCustomerRefundRate(txs, t.customerId),
    }))
  }, [txs, state.controls])

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name ?? r.customerId },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => fmtPct(r.share) },
    { key: 'refund', header: 'Refund rate', align: 'right', render: (r) => fmtPct(r.refundRate) },
    { key: 'flag', header: 'Status', render: (r) => r.atRisk ? <span className="bg-neg/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-neg">at risk</span> : <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">ok</span> },
  ]

  return (
    <div className="space-y-5">
      <ViewHeader index="05" kicker="Accounts" title="Customers" sub="Top 25 by revenue, with churn-risk & refund signals" />
      <DataTable columns={cols} rows={rows} />
    </div>
  )
}
