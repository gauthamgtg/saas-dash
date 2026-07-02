import type { Matrix, Transaction } from '../types'
import { get } from './matrix'

export type RevEventType = 'new' | 'expansion' | 'contraction' | 'churn' | 'reactivation'
export type RevEvent = {
  month: string
  type: RevEventType
  customerId: string
  name: string | null
  amount: number // signed impact on MRR (churn/contraction negative)
  magnitude: number // abs amount, for sorting
}

function firstActive(m: Matrix): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of m.customers) {
    for (const mo of m.months) if (get(m, c, mo) !== 0) { out.set(c, mo); break }
  }
  return out
}
function zeroRunBefore(m: Matrix, c: string, idx: number): number {
  let n = 0
  for (let i = idx - 1; i >= 0; i--) { if (get(m, c, m.months[i]) === 0) n++; else break }
  return n
}
function activeBefore(m: Matrix, c: string, idx: number): boolean {
  for (let i = 0; i < idx; i++) if (get(m, c, m.months[i]) !== 0) return true
  return false
}

/**
 * Per-customer month-over-month movement events (the raw material of a Baremetrics-style
 * activity feed). Mirrors movementSeries' classification but keeps each event individually.
 * Returned newest-month-first, then by magnitude.
 */
export function movementEvents(m: Matrix, txs: Transaction[], reactivationGapK = 1): RevEvent[] {
  const names = new Map<string, string | null>()
  for (const t of txs) if (!names.has(t.customerId)) names.set(t.customerId, t.name)
  const first = firstActive(m)
  const out: RevEvent[] = []
  const push = (month: string, type: RevEventType, c: string, amount: number) =>
    out.push({ month, type, customerId: c, name: names.get(c) ?? null, amount, magnitude: Math.abs(amount) })

  for (let i = 1; i < m.months.length; i++) {
    const month = m.months[i]
    for (const c of m.customers) {
      const cur = get(m, c, month)
      const prev = get(m, c, m.months[i - 1])
      if (cur > 0 && prev === 0) {
        if (first.get(c) === month) push(month, 'new', c, cur)
        else if (zeroRunBefore(m, c, i) >= reactivationGapK && activeBefore(m, c, i)) push(month, 'reactivation', c, cur)
        else push(month, 'new', c, cur)
      } else if (cur > 0 && prev > 0) {
        if (cur > prev) push(month, 'expansion', c, cur - prev)
        else if (cur < prev) push(month, 'contraction', c, -(prev - cur))
      } else if (cur === 0 && prev > 0) {
        push(month, 'churn', c, -prev)
      }
    }
  }
  return out.sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : b.magnitude - a.magnitude))
}
