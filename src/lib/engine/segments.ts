import type { Transaction } from '../types'

type DimKey = 'region' | 'country' | 'businessModel' | 'currency'

export type SegmentRow = { key: string; revenue: number; share: number }

export function revenueByDimension(txs: Transaction[], dim: DimKey): SegmentRow[] {
  const sums = new Map<string, number>()
  let total = 0
  for (const t of txs) {
    const key = (t[dim] ?? 'Unknown') as string
    sums.set(key, (sums.get(key) ?? 0) + t.amountBase)
    total += t.amountBase
  }
  return [...sums.entries()]
    .map(([key, revenue]) => ({ key, revenue, share: total ? revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type CustomerTotal = { customerId: string; name: string | null; revenue: number; share: number }

function customerTotals(txs: Transaction[]): CustomerTotal[] {
  const sums = new Map<string, { name: string | null; revenue: number }>()
  let total = 0
  for (const t of txs) {
    const cur = sums.get(t.customerId) ?? { name: t.name, revenue: 0 }
    cur.revenue += t.amountBase
    sums.set(t.customerId, cur)
    total += t.amountBase
  }
  return [...sums.entries()]
    .map(([customerId, v]) => ({ customerId, name: v.name, revenue: v.revenue, share: total ? v.revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function topCustomers(txs: Transaction[], n: number): CustomerTotal[] {
  return customerTotals(txs).slice(0, n)
}

/** Cumulative revenue share of the top-N customers. */
export function topNShare(txs: Transaction[], n: number): number {
  const totals = customerTotals(txs)
  const grand = totals.reduce((s, t) => s + t.revenue, 0)
  if (!grand) return 0
  return totals.slice(0, n).reduce((s, t) => s + t.revenue, 0) / grand
}

/** Herfindahl-Hirschman index on customer revenue shares, 0..10000 scale. */
export function hhi(txs: Transaction[]): number {
  const totals = customerTotals(txs)
  const grand = totals.reduce((s, t) => s + t.revenue, 0)
  if (!grand) return 0
  return totals.reduce((s, t) => {
    const pct = (100 * t.revenue) / grand
    return s + pct * pct
  }, 0)
}
