import type { Transaction } from '../types'
import { monthDiff } from '../types'
import { median } from './stats'

function customerRevenues(txs: Transaction[]): number[] {
  const sums = new Map<string, number>()
  for (const t of txs) sums.set(t.customerId, (sums.get(t.customerId) ?? 0) + t.amountBase)
  return [...sums.values()]
}

/** 10 equal-count deciles by customer revenue (desc); per decile: customers, revenue, share. */
export function revenueDeciles(txs: Transaction[]): { decile: number; customers: number; revenue: number; share: number }[] {
  const vals = customerRevenues(txs).sort((a, b) => b - a)
  const grand = vals.reduce((s, v) => s + v, 0)
  if (!vals.length || !grand) return []
  const out: { decile: number; customers: number; revenue: number; share: number }[] = []
  for (let d = 0; d < 10; d++) {
    const start = Math.floor((d * vals.length) / 10)
    const end = Math.floor(((d + 1) * vals.length) / 10)
    const slice = vals.slice(start, end)
    const rev = slice.reduce((s, v) => s + v, 0)
    out.push({ decile: d + 1, customers: slice.length, revenue: rev, share: rev / grand })
  }
  return out
}

/** Split into whales (top `topPct` by revenue) vs long tail. */
export function whaleVsLongTail(txs: Transaction[], topPct = 0.2): {
  whaleCount: number; whaleShare: number; tailCount: number; tailShare: number
} {
  const vals = customerRevenues(txs).sort((a, b) => b - a)
  const grand = vals.reduce((s, v) => s + v, 0)
  if (!vals.length || !grand) return { whaleCount: 0, whaleShare: 0, tailCount: 0, tailShare: 0 }
  const whaleCount = Math.max(1, Math.round(topPct * vals.length))
  const whaleRev = vals.slice(0, whaleCount).reduce((s, v) => s + v, 0)
  return {
    whaleCount, whaleShare: whaleRev / grand,
    tailCount: vals.length - whaleCount, tailShare: (grand - whaleRev) / grand,
  }
}

/** Share of customers by inferred billing cadence (median gap between active months). */
export function billingFrequencyMix(txs: Transaction[]): { monthly: number; quarterly: number; annualOrLump: number } {
  const byCust = new Map<string, Set<string>>()
  for (const t of txs) {
    if (t.isRefund) continue
    byCust.set(t.customerId, (byCust.get(t.customerId) ?? new Set()).add(t.month))
  }
  let monthly = 0, quarterly = 0, annualOrLump = 0
  const n = byCust.size
  if (!n) return { monthly: 0, quarterly: 0, annualOrLump: 0 }
  for (const months of byCust.values()) {
    const sorted = [...months].sort()
    if (sorted.length < 2) { annualOrLump++; continue }
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) gaps.push(monthDiff(sorted[i - 1], sorted[i]))
    const med = median(gaps)!
    if (med <= 1.5) monthly++
    else if (med <= 4) quarterly++
    else annualOrLump++
  }
  return { monthly: monthly / n, quarterly: quarterly / n, annualOrLump: annualOrLump / n }
}
