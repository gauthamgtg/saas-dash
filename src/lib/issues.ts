import type { Issue, BlankFieldIssue, DuplicateIdIssue, DuplicateRowIssue } from './normalize'
import type { Transaction } from './types'

export type IssueGroup = { category: string; hint: string; count: number; examples: string[]; items: Issue[] }

const CATEGORY: Record<Issue['kind'], { category: string; hint: string }> = {
  date: { category: 'Dates', hint: 'Try a different date format below' },
  amount: { category: 'Amounts', hint: 'Check the mapped revenue column' },
  currency: { category: 'Currency', hint: 'Add an FX rate for this currency' },
  customerId: { category: 'Customer ID', hint: 'Fill in a customer ID or remove the row' },
  blank: { category: 'Missing details', hint: 'Fill in a value or ignore' },
  duplicateId: { category: 'Duplicate IDs', hint: 'Same invoice/payment number appears on multiple rows' },
  duplicateRow: { category: 'Duplicate rows', hint: 'Same customer, date, and amount appear on multiple rows' },
}

function exampleValue(issue: Issue): string | null {
  if (issue.kind === 'duplicateId' || issue.kind === 'duplicateRow') return issue.paymentIds.join(', ')
  if (issue.blocking) return issue.reason.match(/"([^"]*)"/)?.[1] ?? null
  return issue.reason
}

/** Group issues by category with counts + a few example values + the raw items (for the interactive fix UI). */
export function summarizeIssues(issues: Issue[]): IssueGroup[] {
  const map = new Map<string, { hint: string; count: number; examples: Set<string>; items: Issue[] }>()
  for (const it of issues) {
    const { category, hint } = CATEGORY[it.kind]
    const g = map.get(category) ?? { hint, count: 0, examples: new Set<string>(), items: [] }
    g.count++
    g.items.push(it)
    const val = exampleValue(it)
    if (val && g.examples.size < 5) g.examples.add(val)
    map.set(category, g)
  }
  return [...map.entries()]
    .map(([category, g]) => ({ category, hint: g.hint, count: g.count, examples: [...g.examples], items: g.items }))
    .sort((a, b) => b.count - a.count)
}

type OptionalTxnField = 'invoiceNumber' | 'name' | 'country' | 'region' | 'businessModel'
const OPTIONAL_FIELDS: OptionalTxnField[] = ['invoiceNumber', 'name', 'country', 'region', 'businessModel']

/** Scan already-valid transactions for non-blocking problems: blank optional fields and duplicates. Derived on demand — never persisted, so it can't go stale after an edit. */
export function findWarnings(transactions: Transaction[]): (BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue)[] {
  const warnings: (BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue)[] = []

  for (const field of OPTIONAL_FIELDS) {
    for (const t of transactions) {
      if (!t[field]) warnings.push({ id: `blank:${field}:${t.paymentId}`, blocking: false, kind: 'blank', field, paymentId: t.paymentId, reason: `Missing ${field}` })
    }
  }

  for (const field of ['paymentId', 'invoiceNumber'] as const) {
    const byValue = new Map<string, string[]>()
    for (const t of transactions) {
      const v = field === 'paymentId' ? t.paymentId : t.invoiceNumber
      if (!v) continue
      byValue.set(v, [...(byValue.get(v) ?? []), t.paymentId])
    }
    for (const [value, ids] of byValue) {
      if (ids.length > 1) warnings.push({ id: `dupId:${field}:${value}`, blocking: false, kind: 'duplicateId', field, paymentIds: ids, reason: `Duplicate ${field}: "${value}"` })
    }
  }

  const byRow = new Map<string, string[]>()
  for (const t of transactions) {
    const key = `${t.customerId}|${t.date.getTime()}|${t.amountNative}|${t.currency ?? ''}`
    byRow.set(key, [...(byRow.get(key) ?? []), t.paymentId])
  }
  for (const ids of byRow.values()) {
    if (ids.length > 1) warnings.push({ id: `dupRow:${ids.join(',')}`, blocking: false, kind: 'duplicateRow', paymentIds: ids, reason: `${ids.length} rows share the same customer, date, and amount` })
  }

  return warnings
}
