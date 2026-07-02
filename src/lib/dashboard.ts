import type { Transaction, Controls } from './types'
import { buildMatrix, mrrOf, activeCustomers } from './engine/matrix'
import { arr, arpa, logoChurnRate, avgLifetimeMonths } from './engine/kpis'
import { addMonths } from './types'

export type Filters = { regions: string[]; businessModels: string[]; currencies: string[] }
export type DateRange = { start: string | null; end: string | null }
type DimKey = 'region' | 'country' | 'businessModel' | 'currency'

export function applyFilters(txs: Transaction[], f: Filters, range: DateRange): Transaction[] {
  return txs.filter((t) => {
    if (f.regions.length && !f.regions.includes(t.region ?? 'Unknown')) return false
    if (f.businessModels.length && !f.businessModels.includes(t.businessModel ?? 'Unknown')) return false
    if (f.currencies.length && !f.currencies.includes(t.currency ?? 'Unknown')) return false
    if (range.start && t.month < range.start) return false
    if (range.end && t.month > range.end) return false
    return true
  })
}

export function dimensionValues(txs: Transaction[], dim: DimKey): string[] {
  return [...new Set(txs.map((t) => (t[dim] ?? 'Unknown') as string))].sort()
}

export type OverviewModel = {
  month: string
  mrr: number
  arr: number
  arpa: number | null
  activeCustomers: number
  logoChurn: number | null
  avgLifetime: number | null
}

export function overviewModel(txs: Transaction[], controls: Controls): OverviewModel {
  const m = buildMatrix(txs, controls.mode)
  const month = m.months[m.months.length - 1] ?? ''
  const prev = addMonths(month, -1)
  const churn = logoChurnRate(m, prev, month)
  return {
    month,
    mrr: mrrOf(m, month),
    arr: arr(m, month),
    arpa: arpa(m, month),
    activeCustomers: activeCustomers(m, month),
    logoChurn: churn,
    avgLifetime: churn != null ? avgLifetimeMonths(churn) : null,
  }
}
