import type { Matrix, Transaction } from '../types'
import { get } from './matrix'
import { median } from './stats'
import { monthDiff } from '../types'

/** Share of customers who ever made a second (non-refund) payment. Denominator = all distinct customers. */
export function firstPurchaseToRepeat(txs: Transaction[]): number | null {
  const total = new Set(txs.map((t) => t.customerId)).size
  if (!total) return null
  const counts = new Map<string, number>()
  for (const t of txs) if (!t.isRefund) counts.set(t.customerId, (counts.get(t.customerId) ?? 0) + 1)
  let repeaters = 0
  for (const n of counts.values()) if (n >= 2) repeaters++
  return repeaters / total
}

/** Median days between first and second non-refund payment, among repeaters. */
export function timeToSecondPurchaseDays(txs: Transaction[]): number | null {
  const byCust = new Map<string, number[]>()
  for (const t of txs) if (!t.isRefund) byCust.set(t.customerId, [...(byCust.get(t.customerId) ?? []), t.date.getTime()])
  const gaps: number[] = []
  for (const times of byCust.values()) {
    if (times.length < 2) continue
    times.sort((a, b) => a - b)
    gaps.push((times[1] - times[0]) / 86_400_000)
  }
  return median(gaps)
}

/** Each customer's first (earliest, non-refund) payment amount in base currency. */
export function initialDealSizes(txs: Transaction[]): number[] {
  const firstByCust = new Map<string, { t: number; amt: number }>()
  for (const t of txs) {
    if (t.isRefund) continue
    const cur = firstByCust.get(t.customerId)
    if (!cur || t.date.getTime() < cur.t) firstByCust.set(t.customerId, { t: t.date.getTime(), amt: t.amountBase })
  }
  return [...firstByCust.values()].map((x) => x.amt)
}

/** Per-cohort average cumulative revenue per customer at each age (realized LTV curve). */
export function realizedLtvByCohort(m: Matrix): { cohortMonth: string; size: number; cumAvg: number[] }[] {
  const first = new Map<string, string>()
  for (const c of m.customers) {
    for (const mo of m.months) if (get(m, c, mo) !== 0) { first.set(c, mo); break }
  }
  const groups = new Map<string, string[]>()
  for (const [c, f] of first) groups.set(f, [...(groups.get(f) ?? []), c])
  const last = m.months[m.months.length - 1]
  return [...groups.entries()]
    .sort((a, b) => monthDiff(b[0], a[0]))
    .map(([cohortMonth, members]) => {
      const maxAge = monthDiff(cohortMonth, last)
      const cumAvg: number[] = []
      let running = 0
      for (let age = 0; age <= maxAge; age++) {
        const mo = m.months[m.months.indexOf(cohortMonth) + age]
        running += members.reduce((s, c) => s + get(m, c, mo), 0)
        cumAvg.push(running / members.length)
      }
      return { cohortMonth, size: members.length, cumAvg }
    })
}
