import type { Matrix, Transaction } from '../types'
import { get } from './matrix'

export type FunnelStep = { label: string; count: number; pct: number }

/**
 * Activation/expansion funnel (nested, so counts are monotonically non-increasing):
 * all customers → made a 2nd purchase → recurring (3+ payments) → expanded (recurring AND grew past first month).
 */
export function conversionFunnel(m: Matrix, txs: Transaction[]): FunnelStep[] {
  const total = new Set(txs.map((t) => t.customerId)).size
  const pays = new Map<string, number>()
  for (const t of txs) if (!t.isRefund) pays.set(t.customerId, (pays.get(t.customerId) ?? 0) + 1)
  const repeat = [...pays.values()].filter((n) => n >= 2).length
  const recurring = [...pays.values()].filter((n) => n >= 3).length

  let expanded = 0
  for (const c of m.customers) {
    if ((pays.get(c) ?? 0) < 3) continue
    const vals = m.months.map((mo) => get(m, c, mo)).filter((v) => v > 0)
    if (vals.length && Math.max(...vals) > vals[0] * 1.001) expanded++
  }

  const pct = (n: number) => (total ? n / total : 0)
  return [
    { label: 'All customers', count: total, pct: 1 },
    { label: 'Made 2nd purchase', count: repeat, pct: pct(repeat) },
    { label: 'Recurring (3+)', count: recurring, pct: pct(recurring) },
    { label: 'Expanded', count: expanded, pct: pct(expanded) },
  ]
}
