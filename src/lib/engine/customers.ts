import type { Matrix, Transaction } from '../types'
import { get } from './matrix'

/** True if the customer's MRR strictly declined for the last `streak` transitions, all > 0. */
export function atRisk(m: Matrix, customer: string, streak: number): boolean {
  const vals = m.months.map((mo) => get(m, customer, mo))
  let declines = 0
  for (let i = vals.length - 1; i > 0; i--) {
    if (vals[i] > 0 && vals[i - 1] > 0 && vals[i] < vals[i - 1]) declines++
    else break
  }
  return declines >= streak
}

/** Refunded fraction of a customer's gross spend (uses signed refund rows). */
export function perCustomerRefundRate(txs: Transaction[], customer: string): number | null {
  let gross = 0, refunded = 0
  for (const t of txs) {
    if (t.customerId !== customer) continue
    if (t.isRefund) refunded += Math.abs(t.amountBase)
    else gross += t.amountBase
  }
  return gross > 0 ? refunded / gross : null
}

/** Days since the customer's most recent non-refund payment, relative to asOf. */
export function recencyDays(txs: Transaction[], customer: string, asOf: Date): number | null {
  const dates = txs.filter((t) => t.customerId === customer && !t.isRefund).map((t) => t.date.getTime())
  if (!dates.length) return null
  const last = Math.max(...dates)
  return Math.round((asOf.getTime() - last) / 86_400_000)
}

/** Customers with no payment within `dormancyDays` of asOf (but previously active). */
export function dormantCustomers(txs: Transaction[], asOf: Date, dormancyDays: number): string[] {
  const ids = [...new Set(txs.map((t) => t.customerId))]
  return ids.filter((c) => {
    const r = recencyDays(txs, c, asOf)
    return r !== null && r > dormancyDays
  })
}
