import type { Mapping } from './mapping'
import type { Transaction } from './types'
import { monthKey } from './types'
import { convert, type FxRates } from './fx'

export type DataIssue = { rowIndex: number; reason: string; raw: Record<string, string> }
export type NormalizeOpts = { includeRefunds: boolean }
export type NormalizeResult = { transactions: Transaction[]; issues: DataIssue[] }

const TRUE = new Set(['true', '1', 'yes', 'y', 't', 'refund', 'refunded'])

function get(row: Record<string, string>, col: string | null): string | null {
  if (!col) return null
  const v = row[col]
  return v == null ? null : String(v).trim()
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, '')
  if (cleaned === '' || isNaN(Number(cleaned))) return null
  return Number(cleaned)
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  rates: FxRates,
  opts: NormalizeOpts,
): NormalizeResult {
  const transactions: Transaction[] = []
  const issues: DataIssue[] = []

  rows.forEach((raw, i) => {
    const dateStr = get(raw, mapping.date)
    const d = dateStr ? new Date(dateStr) : null
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

  return { transactions, issues }
}
