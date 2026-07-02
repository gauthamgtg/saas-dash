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

/** HHI on any dimension's revenue shares (region/country/businessModel/currency), 0..10000. */
export function dimensionHhi(txs: Transaction[], dim: DimKey): number {
  const rows = revenueByDimension(txs, dim)
  return rows.reduce((s, r) => s + Math.pow(r.share * 100, 2), 0)
}

/** Largest single currency's share of revenue (FX exposure). */
export function dominantCurrencyShare(txs: Transaction[]): number {
  const rows = revenueByDimension(txs, 'currency')
  return rows.length ? rows[0].share : 0
}

/** Pareto: fraction of customers producing 80% of revenue, and the top-20%'s revenue share. */
export function paretoConcentration(txs: Transaction[]): { customersToEightyPct: number | null; top20Share: number } {
  const totals = customerTotals(txs).filter((t) => t.revenue > 0)
  const grand = totals.reduce((s, t) => s + t.revenue, 0)
  if (!grand || !totals.length) return { customersToEightyPct: null, top20Share: 0 }
  let cum = 0, kTo80 = totals.length
  for (let i = 0; i < totals.length; i++) {
    cum += totals[i].revenue
    if (cum / grand >= 0.8) { kTo80 = i + 1; break }
  }
  const top20Count = Math.max(1, Math.ceil(0.2 * totals.length))
  const top20Rev = totals.slice(0, top20Count).reduce((s, t) => s + t.revenue, 0)
  return { customersToEightyPct: kTo80 / totals.length, top20Share: top20Rev / grand }
}

/** Gini coefficient of customer revenue inequality (0 equal … 1 concentrated). */
export function gini(txs: Transaction[]): number | null {
  const vals = customerTotals(txs).map((t) => t.revenue).filter((v) => v > 0).sort((a, b) => a - b)
  const n = vals.length
  if (n < 2) return null
  const total = vals.reduce((s, v) => s + v, 0)
  if (!total) return null
  let weighted = 0
  for (let i = 0; i < n; i++) weighted += (i + 1) * vals[i] // ascending, 1-indexed
  return (2 * weighted) / (n * total) - (n + 1) / n
}
