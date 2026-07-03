export const MRR_MODES = ['activity', 'subscription'] as const
export type MrrMode = (typeof MRR_MODES)[number]

/** A cleaned, FX-converted payment. amountBase is negative for refunds when they are subtracted. */
export type Transaction = {
  paymentId: string
  invoiceNumber: string | null
  date: Date
  month: string // 'YYYY-MM'
  customerId: string
  name: string | null
  country: string | null
  region: string | null
  businessModel: string | null
  currency: string | null // native
  amountNative: number
  amountBase: number // FX-converted, signed (negative if a subtracted refund)
  isRefund: boolean
}

/** M[customerId][month] = revenue in base currency. Missing month => absent (treat as 0). */
export type Matrix = {
  cells: Map<string, Map<string, number>> // customerId -> month -> revenue
  months: string[] // sorted, contiguous
  customers: string[]
  mode: MrrMode
}

export type BinDef = { label: string; min: number; max: number | null } // (min, max]; max=null => open top

export type ComparePeriod = 'none' | 'mom' | 'qoq' | 'yoy'
export const COMPARE_OFFSET: Record<ComparePeriod, number> = { none: 0, mom: 1, qoq: 3, yoy: 12 }
export const COMPARE_LABEL: Record<ComparePeriod, string> = { none: 'none', mom: '1mo ago', qoq: '1q ago', yoy: '1yr ago' }

export type Controls = {
  mode: MrrMode
  includeRefunds: boolean
  reactivationGapK: number // min zero-months to count a return as reactivation
  dormancyDays: number
  atRiskStreak: number
  grossMargin: number // 0..1, LTV assumption
  comparePeriod: ComparePeriod // prior-period comparison basis for ghost overlays
}

export const DEFAULT_BINS: BinDef[] = [
  { label: 'Less than $250', min: -Infinity, max: 250 },
  { label: '$251 - $500', min: 250, max: 500 },
  { label: '$501 - $1000', min: 500, max: 1000 },
  { label: '$1001 - $2500', min: 1000, max: 2500 },
  { label: 'More than $2500', min: 2500, max: null },
]

export function monthKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12 + 12) % 12
  return `${ny}-${String(nm + 1).padStart(2, '0')}`
}

/** Number of months from a to b (b - a). */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return by * 12 + bm - (ay * 12 + am)
}

export function monthRange(start: string, end: string): string[] {
  const out: string[] = []
  for (let m = start; monthDiff(m, end) >= 0; m = addMonths(m, 1)) out.push(m)
  return out
}
