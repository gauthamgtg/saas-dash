import type { Mapping, ColumnField } from './mapping'
import type { Transaction } from './types'
import { monthKey } from './types'
import { convert, type FxRates } from './fx'
import { parseDate, detectDateOrder, type DateOrder } from './date'

type IssueBase = { id: string; reason: string }

export type BlockingIssue = IssueBase & {
  blocking: true
  rowIndex: number
  kind: 'date' | 'amount' | 'currency' | 'customerId'
  field: ColumnField
  raw: Record<string, string>
}

export type BlankFieldIssue = IssueBase & {
  blocking: false
  kind: 'blank'
  field: 'invoiceNumber' | 'name' | 'country' | 'region' | 'businessModel'
  paymentId: string
}

export type DuplicateIdIssue = IssueBase & {
  blocking: false
  kind: 'duplicateId'
  field: 'paymentId' | 'invoiceNumber'
  paymentIds: string[]
}

export type DuplicateRowIssue = IssueBase & {
  blocking: false
  kind: 'duplicateRow'
  paymentIds: string[]
}

export type Issue = BlockingIssue | BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue

export type NormalizeOpts = { includeRefunds: boolean; dateOrder?: DateOrder }
export type RowFixes = {
  overrides?: Record<number, Record<string, string>>   // rowIndex -> {columnHeader: newRawValue}
  dateOrders?: Record<number, Exclude<DateOrder, 'auto'>> // rowIndex -> order override, for re-parsing just this row
  removed?: Set<number>                                  // rowIndexes to exclude entirely
}
export type NormalizeResult = { transactions: Transaction[]; issues: BlockingIssue[]; resolvedDateOrder: Exclude<DateOrder, 'auto'>; total: number }

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

/** Validate + build one row. Pure — reused by the bulk `normalize()` loop and by single-row re-fix in the issue pipeline. */
export function normalizeRow(
  raw: Record<string, string>,
  rowIndex: number,
  mapping: Mapping,
  rates: FxRates,
  opts: { includeRefunds: boolean; dateOrder: Exclude<DateOrder, 'auto'> },
): { transaction: Transaction } | { issue: BlockingIssue } {
  const id = `row:${rowIndex}`
  const dateStr = get(raw, mapping.date)
  const d = parseDate(dateStr, opts.dateOrder)
  if (!d || isNaN(d.getTime())) {
    return { issue: { id, blocking: true, rowIndex, kind: 'date', field: 'date', reason: `Unparseable date: "${dateStr ?? ''}"`, raw } }
  }
  const amtStr = get(raw, mapping.amount) ?? ''
  const amt = parseAmount(amtStr)
  if (amt === null) {
    return { issue: { id, blocking: true, rowIndex, kind: 'amount', field: 'amount', reason: `Non-numeric amount: "${amtStr}"`, raw } }
  }
  const currency = get(raw, mapping.currency)
  const base = convert(Math.abs(amt), currency, rates)
  if (base === null) {
    return { issue: { id, blocking: true, rowIndex, kind: 'currency', field: 'currency', reason: `Unknown currency: "${currency ?? ''}" (add an FX rate)`, raw } }
  }
  const customerId = get(raw, mapping.customerId)
  if (!customerId) {
    return { issue: { id, blocking: true, rowIndex, kind: 'customerId', field: 'customerId', reason: 'Missing customer ID', raw } }
  }
  const refundFlag = (get(raw, mapping.refundFlag) ?? '').toLowerCase()
  const isRefund = TRUE.has(refundFlag) || amt < 0

  return {
    transaction: {
      paymentId: get(raw, mapping.paymentId) ?? String(rowIndex),
      invoiceNumber: get(raw, mapping.invoiceNumber),
      date: d,
      month: monthKey(d),
      customerId,
      name: get(raw, mapping.name),
      country: get(raw, mapping.country),
      region: get(raw, mapping.region),
      businessModel: get(raw, mapping.businessModel),
      currency,
      amountNative: amt,
      amountBase: isRefund ? -Math.abs(base) : Math.abs(base),
      isRefund,
    },
  }
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  rates: FxRates,
  opts: NormalizeOpts,
  fixes?: RowFixes,
): NormalizeResult {
  const transactions: Transaction[] = []
  const issues: BlockingIssue[] = []
  const resolvedDateOrder = !opts.dateOrder || opts.dateOrder === 'auto'
    ? detectDateOrder(rows.map((r) => get(r, mapping.date)))
    : opts.dateOrder
  const overrides = fixes?.overrides ?? {}
  const dateOrders = fixes?.dateOrders ?? {}
  const removed = fixes?.removed ?? new Set<number>()

  rows.forEach((raw, i) => {
    if (removed.has(i)) return
    const patchedRaw = overrides[i] ? { ...raw, ...overrides[i] } : raw
    const order = dateOrders[i] ?? resolvedDateOrder
    const result = normalizeRow(patchedRaw, i, mapping, rates, { includeRefunds: opts.includeRefunds, dateOrder: order })
    if ('issue' in result) { issues.push(result.issue); return }
    if (result.transaction.isRefund && !opts.includeRefunds) return // gross view: ignore refunds
    transactions.push(result.transaction)
  })

  return { transactions, issues, resolvedDateOrder, total: rows.length }
}
