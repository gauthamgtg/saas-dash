import type { Transaction } from './types'

/** Compound monthly growth needed to move `from` → `to` in `months`. null when undefined. */
export function requiredGrowth(from: number, to: number, months: number): number | null {
  if (from <= 0 || to <= 0 || months < 1) return null
  return Math.pow(to / from, 1 / months) - 1
}

/** Whole months for `from` to reach `to` compounding at `g`/mo. 0 if already there, null if never. */
export function monthsToTarget(from: number, to: number, g: number | null): number | null {
  if (from >= to) return 0
  if (from <= 0 || g == null || g <= 0) return null
  return Math.ceil(Math.log(to / from) / Math.log(1 + g))
}

/** Local-calendar YYYY-MM-DD (toISOString would shift days across time zones). */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Net cash collected per calendar day (refunds already signed negative in amountBase). */
export function dailyCollections(txs: Transaction[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const t of txs) {
    const k = dayKey(t.date)
    out.set(k, (out.get(k) ?? 0) + t.amountBase)
  }
  return out
}
