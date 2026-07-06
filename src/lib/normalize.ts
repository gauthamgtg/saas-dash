import type { Mapping } from './mapping'
import type { Transaction } from './types'
import { monthKey } from './types'
import { convert, type FxRates } from './fx'
import { parseDate, detectDateOrder, type DateOrder } from './date'

export type DataIssue = { rowIndex: number; reason: string; raw: Record<string, string> }
export type NormalizeOpts = { includeRefunds: boolean; dateOrder?: DateOrder }
export type NormalizeResult = { transactions: Transaction[]; issues: DataIssue[]; resolvedDateOrder: Exclude<DateOrder, 'auto'>; total: number }

const TRUE = new Set(['true', '1', 'yes', 'y', 't', 'refund', 'refunded'])

function get(row: Record<string, string>, col: string | null): string | null {
  if (!col) return null
  const v = row[col]
  return v == null ? null : String(v).trim()
}

/** Handles currency symbols, thousands separators, and parenthesised negatives, e.g. "($1,250.00)" → -1250. */
function parseAmount(s: string): number | null {
  let t = s.trim()
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (/-/.test(t)) neg = true
  t = t.replace(/[^0-9.]/g, '') // strip currency symbols, commas, spaces, letters
  if (t === '' || isNaN(Number(t))) return null
  const n = Number(t)
  return neg ? -Math.abs(n) : n
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  rates: FxRates,
  opts: NormalizeOpts,
): NormalizeResult {
  const transactions: Transaction[] = []
  const issues: DataIssue[] = []
  const resolvedDateOrder = !opts.dateOrder || opts.dateOrder === 'auto'
    ? detectDateOrder(rows.map((r) => get(r, mapping.date)))
    : opts.dateOrder

  rows.forEach((raw, i) => {
    const dateStr = get(raw, mapping.date)
    const d = parseDate(dateStr, resolvedDateOrder)
    if (!d || isNaN(d.getTime())) {
      issues.push({ rowIndex: i, reason: `Unparseable date: "${dateStr ?? ''}"`, raw })
      return
    }
    const amtStr = get(raw, mapping.amount) ?? ''
    const amt = parseAmount(amtStr)
    if (amt === null) {
      issues.push({ rowIndex: i, reason: `Non-numeric amount: "${amtStr}"`, raw })
      return
    }
    const currency = get(raw, mapping.currency)
    const base = convert(Math.abs(amt), currency, rates)
    if (base === null) {
      issues.push({ rowIndex: i, reason: `Unknown currency: "${currency ?? ''}" (add an FX rate)`, raw })
      return
    }
    const refundFlag = (get(raw, mapping.refundFlag) ?? '').toLowerCase()
    const isRefund = TRUE.has(refundFlag) || amt < 0

    if (isRefund && !opts.includeRefunds) return // gross view: ignore refunds

    transactions.push({
      paymentId: get(raw, mapping.paymentId) ?? String(i),
      invoiceNumber: get(raw, mapping.invoiceNumber),
      date: d,
      month: monthKey(d),
      customerId: get(raw, mapping.customerId) ?? '',
      name: get(raw, mapping.name),
      country: get(raw, mapping.country),
      region: get(raw, mapping.region),
      businessModel: get(raw, mapping.businessModel),
      currency,
      amountNative: amt,
      amountBase: isRefund ? -Math.abs(base) : Math.abs(base),
      isRefund,
    })
  })

  return { transactions, issues, resolvedDateOrder, total: rows.length }
}
