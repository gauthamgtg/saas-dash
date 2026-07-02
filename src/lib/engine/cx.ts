import type { Matrix, Transaction } from '../types'
import { get } from './matrix'
import { median, cv, quintile } from './stats'
import { recencyDays } from './customers'

/** RFM scoring (1-5 each) from payments. Monetary/frequency exclude refunds. */
export function rfm(txs: Transaction[], asOf: Date): { customerId: string; r: number; f: number; m: number; score: number }[] {
  const ids = [...new Set(txs.map((t) => t.customerId))]
  const recency = new Map<string, number>()
  const freq = new Map<string, number>()
  const monetary = new Map<string, number>()
  for (const id of ids) {
    recency.set(id, recencyDays(txs, id, asOf) ?? 1e9)
    freq.set(id, txs.filter((t) => t.customerId === id && !t.isRefund).length)
    monetary.set(id, txs.filter((t) => t.customerId === id && !t.isRefund).reduce((s, t) => s + t.amountBase, 0))
  }
  const recPop = [...recency.values()]
  const freqPop = [...freq.values()]
  const monPop = [...monetary.values()]
  return ids.map((id) => {
    // recency: lower is better, so invert the quintile
    const r = 6 - quintile(recency.get(id)!, recPop)
    const f = quintile(freq.get(id)!, freqPop)
    const m = quintile(monetary.get(id)!, monPop)
    return { customerId: id, r, f, m, score: r + f + m }
  })
}

/** Median days between a customer's consecutive non-refund payments. */
export function cadenceDays(txs: Transaction[], customerId: string): number | null {
  const times = txs.filter((t) => t.customerId === customerId && !t.isRefund).map((t) => t.date.getTime()).sort((a, b) => a - b)
  if (times.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / 86_400_000)
  return median(gaps)
}

/** Coefficient of variation of a customer's monthly revenue over their active span. */
export function revenueVolatility(m: Matrix, customerId: string): number | null {
  const vals = m.months.map((mo) => get(m, customerId, mo))
  const firstIdx = vals.findIndex((v) => v !== 0)
  if (firstIdx < 0) return null
  let lastIdx = vals.length - 1
  while (lastIdx > firstIdx && vals[lastIdx] === 0) lastIdx--
  return cv(vals.slice(firstIdx, lastIdx + 1))
}

/** Refund latency in days: refund row date − its matched original payment date (by invoice). */
export function refundLatencies(txs: Transaction[]): number[] {
  const originalByInvoice = new Map<string, number>() // earliest non-refund date per invoice
  for (const t of txs) {
    if (t.isRefund || !t.invoiceNumber) continue
    const cur = originalByInvoice.get(t.invoiceNumber)
    if (cur == null || t.date.getTime() < cur) originalByInvoice.set(t.invoiceNumber, t.date.getTime())
  }
  const out: number[] = []
  for (const t of txs) {
    if (!t.isRefund || !t.invoiceNumber) continue
    const orig = originalByInvoice.get(t.invoiceNumber)
    if (orig != null) out.push((t.date.getTime() - orig) / 86_400_000)
  }
  return out
}

/** Share of customers who never had a refund row. */
export function refundFreeShare(txs: Transaction[]): number | null {
  const all = new Set(txs.map((t) => t.customerId))
  if (!all.size) return null
  const refunded = new Set(txs.filter((t) => t.isRefund).map((t) => t.customerId))
  return [...all].filter((c) => !refunded.has(c)).length / all.size
}

/**
 * Composite health score 0-100 per customer (tunable, transparent proxy — payments only).
 * recencyFreshness + mrrTrend − refundPenalty + tenure, weighted.
 */
export function healthScore(
  m: Matrix, txs: Transaction[], customerId: string, asOf: Date, dormancyDays: number,
): number {
  const rec = recencyDays(txs, customerId, asOf) ?? 1e9
  const freshness = Math.max(0, 1 - rec / (dormancyDays * 2)) // 1 fresh … 0 stale
  const vals = m.months.map((mo) => get(m, customerId, mo)).filter((_, i, arr) => arr.slice(0, i + 1).some((v) => v !== 0))
  const active = vals.filter((v) => v !== 0)
  const trend = active.length >= 2 ? Math.sign(active[active.length - 1] - active[0]) : 0 // -1..1
  const gross = txs.filter((t) => t.customerId === customerId && !t.isRefund).reduce((s, t) => s + t.amountBase, 0)
  const refunded = txs.filter((t) => t.customerId === customerId && t.isRefund).reduce((s, t) => s + Math.abs(t.amountBase), 0)
  const refundPenalty = gross > 0 ? Math.min(1, refunded / gross) : 0
  const tenureMonths = active.length
  const tenureScore = Math.min(1, tenureMonths / 12)
  const raw = 0.4 * freshness + 0.25 * ((trend + 1) / 2) - 0.2 * refundPenalty + 0.15 * tenureScore
  return Math.round(Math.max(0, Math.min(1, raw)) * 100)
}
