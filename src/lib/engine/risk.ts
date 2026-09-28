import type { Matrix, Transaction } from '../types'
import { get, mrrOf } from './matrix'
import { atRisk } from './customers'
import { topNShare, hhi } from './segments'
import { addMonths } from '../types'

export type AtRiskAccount = {
  customerId: string
  name: string | null
  mrr: number
  streak: number
}

/** At-risk accounts with $ MRR exposed (decline streak). */
export function atRiskRevenue(m: Matrix, txs: Transaction[], streak: number): {
  accounts: AtRiskAccount[]
  mrrAtRisk: number
  shareOfMrr: number
} {
  const last = m.months[m.months.length - 1] ?? ''
  const nameBy = new Map<string, string | null>()
  for (const t of txs) if (!nameBy.has(t.customerId)) nameBy.set(t.customerId, t.name)
  const accounts: AtRiskAccount[] = []
  for (const c of m.customers) {
    if (!atRisk(m, c, streak)) continue
    const vals = m.months.map((mo) => get(m, c, mo))
    let declines = 0
    for (let i = vals.length - 1; i > 0; i--) {
      if (vals[i] > 0 && vals[i - 1] > 0 && vals[i] < vals[i - 1]) declines++
      else break
    }
    const mrr = get(m, c, last)
    if (mrr <= 0) continue
    accounts.push({ customerId: c, name: nameBy.get(c) ?? c, mrr, streak: declines })
  }
  accounts.sort((a, b) => b.mrr - a.mrr)
  const mrrAtRisk = accounts.reduce((s, a) => s + a.mrr, 0)
  const total = mrrOf(m, last) || 1
  return { accounts, mrrAtRisk, shareOfMrr: mrrAtRisk / total }
}

/** Top-N concentration % of MRR over time (covenant tracking). */
export function concentrationTrend(m: Matrix, n = 5): { month: string; topShare: number; hhiApprox: number }[] {
  return m.months.map((mo) => {
    const rows = m.customers
      .map((c) => get(m, c, mo))
      .filter((v) => v > 0)
      .sort((a, b) => b - a)
    const total = rows.reduce((s, v) => s + v, 0) || 1
    const topShare = rows.slice(0, n).reduce((s, v) => s + v, 0) / total
    const hhiApprox = rows.reduce((s, v) => {
      const p = (100 * v) / total
      return s + p * p
    }, 0)
    return { month: mo, topShare, hhiApprox }
  })
}

/** Covenant breach flags vs thresholds. */
export function concentrationCovenants(
  top1Share: number,
  top10Share: number,
  hhiValue: number,
  limits = { top1: 0.25, top10: 0.5, hhi: 2500 },
): { id: string; ok: boolean; value: number; limit: number; label: string }[] {
  return [
    { id: 'top1', label: 'Top customer ≤ 25% ARR', value: top1Share, limit: limits.top1, ok: top1Share <= limits.top1 },
    { id: 'top10', label: 'Top 10 ≤ 50% ARR', value: top10Share, limit: limits.top10, ok: top10Share <= limits.top10 },
    { id: 'hhi', label: 'HHI ≤ 2500', value: hhiValue, limit: limits.hhi, ok: hhiValue <= limits.hhi },
  ]
}

/** Current top-1 / top-10 share of revenue from payment totals. */
export function currentConcentration(txs: Transaction[]): { top1: number; top5: number; top10: number; hhi: number } {
  return {
    top1: topNShare(txs, 1),
    top5: topNShare(txs, 5),
    top10: topNShare(txs, 10),
    hhi: hhi(txs),
  }
}

/** Month-over-month delta in at-risk $ (needs prior snapshot approximated from streak history). */
export function atRiskTrend(m: Matrix, streak: number): { month: string; count: number; mrr: number }[] {
  const out: { month: string; count: number; mrr: number }[] = []
  for (let i = streak; i < m.months.length; i++) {
    const mo = m.months[i]
    // Build a truncated matrix view by checking decline over months[0..i]
    let count = 0, mrr = 0
    for (const c of m.customers) {
      let declines = 0
      for (let j = i; j > 0; j--) {
        const cur = get(m, c, m.months[j])
        const prev = get(m, c, m.months[j - 1])
        if (cur > 0 && prev > 0 && cur < prev) declines++
        else break
      }
      if (declines >= streak) {
        const v = get(m, c, mo)
        if (v > 0) { count++; mrr += v }
      }
    }
    out.push({ month: mo, count, mrr })
  }
  return out
}

export function trailingMonths(m: Matrix, n: number): string[] {
  return m.months.slice(Math.max(0, m.months.length - n))
}

/** Simple MoM series helper for risk view. */
export function mrrSeries(m: Matrix): { month: string; mrr: number }[] {
  return m.months.map((month) => ({ month, mrr: mrrOf(m, month) }))
}

void addMonths
