import type { Matrix } from '../types'
import type { SpendRow } from '../spend'
import { addMonths, monthDiff } from '../types'
import { mrrOf } from './matrix'
import { spendByMonth } from './unitEconomics'

/**
 * Burn Multiple ≈ Net Burn / Net New ARR over a trailing window.
 * Net Burn = max(0, total spend − revenue) for months with reported spend.
 * Needs category `other` (opex) plus S&M for a believable burn figure.
 */
export function burnMultiple(m: Matrix, spend: SpendRow[], windowMonths = 3): number | null {
  if (!m.months.length || !spend.length) return null
  const all = spendByMonth(spend)
  const last = m.months[m.months.length - 1]
  const start = addMonths(last, -(windowMonths - 1))
  const window = m.months.filter((mo) => monthDiff(start, mo) >= 0 && monthDiff(mo, last) >= 0)
  const withSpend = window.filter((mo) => all.has(mo))
  if (withSpend.length < 1) return null

  let rev = 0, costs = 0
  for (const mo of withSpend) {
    rev += mrrOf(m, mo)
    costs += all.get(mo) ?? 0
  }
  const netBurn = costs - rev
  const open = mrrOf(m, addMonths(withSpend[0], -1))
  const close = mrrOf(m, withSpend[withSpend.length - 1])
  const netNewArr = (close - open) * 12
  if (netNewArr <= 0) return netBurn > 0 ? Infinity : 0
  return netBurn / netNewArr
}

/** Cash runway proxy in months = cash / avg monthly net burn (needs cash input). */
export function runwayMonths(cash: number, avgMonthlyNetBurn: number): number | null {
  if (cash < 0) return null
  if (avgMonthlyNetBurn <= 0) return Infinity
  return cash / avgMonthlyNetBurn
}

/** Average monthly net burn over months that have spend reported. */
export function avgMonthlyNetBurn(m: Matrix, spend: SpendRow[], windowMonths = 3): number | null {
  if (!m.months.length || !spend.length) return null
  const all = spendByMonth(spend)
  const last = m.months[m.months.length - 1]
  const start = addMonths(last, -(windowMonths - 1))
  const withSpend = m.months.filter((mo) => monthDiff(start, mo) >= 0 && monthDiff(mo, last) >= 0 && all.has(mo))
  if (!withSpend.length) return null
  let total = 0
  for (const mo of withSpend) total += (all.get(mo) ?? 0) - mrrOf(m, mo)
  return total / withSpend.length
}
