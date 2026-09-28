import type { ParsedFile } from './parse'

export const SPEND_CATEGORIES = ['marketing', 'sales', 'other'] as const
export type SpendCategory = (typeof SPEND_CATEGORIES)[number]

/** One month of spend on one channel, in the dashboard's base currency. */
export type SpendRow = {
  month: string // 'YYYY-MM'
  channel: string
  category: SpendCategory
  amount: number
}

const HEADER_ALIASES: Record<'month' | 'channel' | 'category' | 'amount', string[]> = {
  month: ['month', 'date', 'period'],
  channel: ['channel', 'source', 'campaign', 'vendor', 'name'],
  category: ['category', 'type', 'bucket'],
  amount: ['amount', 'spend', 'cost', 'total'],
}

function findHeader(headers: string[], field: keyof typeof HEADER_ALIASES): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const alias of HEADER_ALIASES[field]) {
    const i = lower.indexOf(alias)
    if (i >= 0) return headers[i]
  }
  return null
}

/** 'YYYY-MM', 'YYYY-MM-DD', or anything Date can parse → 'YYYY-MM'. null if unusable. */
function toMonth(raw: string): string | null {
  const s = raw.trim()
  const m = s.match(/^(\d{4})[-/](\d{1,2})/)
  if (m) {
    const mo = Number(m[2])
    if (mo >= 1 && mo <= 12) return `${m[1]}-${String(mo).padStart(2, '0')}`
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return null
}

function toAmount(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ''))
  return isFinite(n) ? n : null
}

/**
 * Parse an uploaded spend file. Required columns: month + amount.
 * Optional: channel (free text), category (marketing|sales|other, defaults to marketing).
 */
export function parseSpendRows(parsed: ParsedFile): { rows: SpendRow[]; errors: string[] } {
  const errors: string[] = []
  const hMonth = findHeader(parsed.headers, 'month')
  const hAmount = findHeader(parsed.headers, 'amount')
  const hChannel = findHeader(parsed.headers, 'channel')
  const hCategory = findHeader(parsed.headers, 'category')
  if (!hMonth || !hAmount) {
    return { rows: [], errors: [`Missing required column${!hMonth && !hAmount ? 's' : ''}: ${[!hMonth && 'month', !hAmount && 'amount'].filter(Boolean).join(', ')}. Found: ${parsed.headers.join(', ') || '(none)'}`] }
  }
  const rows: SpendRow[] = []
  parsed.rows.forEach((r, i) => {
    const month = toMonth(r[hMonth] ?? '')
    const amount = toAmount(r[hAmount] ?? '')
    if (!month || amount == null) {
      errors.push(`Row ${i + 2}: ${!month ? `bad month "${r[hMonth]}"` : `bad amount "${r[hAmount]}"`}`)
      return
    }
    const rawCat = (hCategory ? r[hCategory] : '').toLowerCase().trim()
    const category: SpendCategory = (SPEND_CATEGORIES as readonly string[]).includes(rawCat) ? (rawCat as SpendCategory) : 'marketing'
    rows.push({ month, channel: (hChannel ? r[hChannel] : '').trim() || 'Unattributed', category, amount })
  })
  return { rows, errors }
}

/** Example rows for the downloadable template. */
export const SPEND_TEMPLATE: Record<string, string | number>[] = [
  { month: '2026-01', channel: 'Google Ads', category: 'marketing', amount: 12000 },
  { month: '2026-01', channel: 'Meta Ads', category: 'marketing', amount: 8000 },
  { month: '2026-01', channel: 'Content / SEO', category: 'marketing', amount: 3000 },
  { month: '2026-01', channel: 'Sales salaries & commissions', category: 'sales', amount: 25000 },
  { month: '2026-01', channel: 'Other operating costs', category: 'other', amount: 40000 },
  { month: '2026-02', channel: 'Google Ads', category: 'marketing', amount: 14000 },
]
