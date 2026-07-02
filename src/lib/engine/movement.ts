import type { Matrix } from '../types'
import { get } from './matrix'

export type Movement = {
  month: string
  prevMonth: string | null
  newMrr: number
  expansion: number
  contraction: number
  churn: number
  reactivation: number
  netNew: number
}

export type MovementOpts = { reactivationGapK: number }

/** First active month per customer (earliest month with nonzero revenue). */
function firstActive(m: Matrix): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of m.customers) {
    for (const mo of m.months) {
      if (get(m, c, mo) !== 0) { out.set(c, mo); break }
    }
  }
  return out
}

/** True if the customer was active at any month strictly before `month`. */
function activeBefore(m: Matrix, c: string, monthIdx: number): boolean {
  for (let i = 0; i < monthIdx; i++) if (get(m, c, m.months[i]) !== 0) return true
  return false
}

/** Count of consecutive zero months immediately before monthIdx. */
function zeroRunBefore(m: Matrix, c: string, monthIdx: number): number {
  let n = 0
  for (let i = monthIdx - 1; i >= 0; i--) {
    if (get(m, c, m.months[i]) === 0) n++
    else break
  }
  return n
}

export function movementSeries(m: Matrix, opts: MovementOpts): Movement[] {
  const first = firstActive(m)
  const out: Movement[] = []
  for (let i = 1; i < m.months.length; i++) {
    const month = m.months[i]
    const prevMonth = m.months[i - 1]
    let newMrr = 0, expansion = 0, contraction = 0, churn = 0, reactivation = 0
    for (const c of m.customers) {
      const cur = get(m, c, month)
      const prev = get(m, c, prevMonth)
      if (cur > 0 && prev === 0) {
        if (first.get(c) === month) newMrr += cur
        else if (zeroRunBefore(m, c, i) >= opts.reactivationGapK && activeBefore(m, c, i)) reactivation += cur
        else newMrr += cur // active-but-not-first with sub-K gap: treat as new activity
      } else if (cur > 0 && prev > 0) {
        if (cur > prev) expansion += cur - prev
        else if (cur < prev) contraction += prev - cur
      } else if (cur === 0 && prev > 0) {
        churn += prev
      }
    }
    out.push({
      month, prevMonth, newMrr, expansion, contraction, churn, reactivation,
      netNew: newMrr + expansion + reactivation - contraction - churn,
    })
  }
  return out
}
