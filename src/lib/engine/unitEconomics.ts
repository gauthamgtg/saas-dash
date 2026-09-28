import type { Matrix } from '../types'
import type { SpendRow } from '../spend'
import { addMonths, monthDiff } from '../types'
import { get, mrrOf } from './matrix'

/** customerId's first active month → count per month. */
export function newCustomersByMonth(m: Matrix): Map<string, number> {
  const out = new Map<string, number>()
  for (const c of m.customers) {
    for (const mo of m.months) {
      if (get(m, c, mo) > 0) { out.set(mo, (out.get(mo) ?? 0) + 1); break }
    }
  }
  return out
}

/** Spend per month, optionally restricted to categories (e.g. S&M = marketing+sales). */
export function spendByMonth(spend: SpendRow[], categories?: readonly string[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of spend) {
    if (categories && !categories.includes(r.category)) continue
    out.set(r.month, (out.get(r.month) ?? 0) + r.amount)
  }
  return out
}

export type CacPoint = { month: string; smSpend: number; newCustomers: number; cac: number | null }

/** Monthly blended CAC = S&M spend / new customers acquired that month. */
export function cacSeries(m: Matrix, spend: SpendRow[]): CacPoint[] {
  const sm = spendByMonth(spend, ['marketing', 'sales'])
  const fresh = newCustomersByMonth(m)
  // only months where spend was reported — no spend row means "unknown", not "free"
  return m.months.filter((mo) => sm.has(mo)).map((mo) => {
    const smSpend = sm.get(mo) ?? 0
    const n = fresh.get(mo) ?? 0
    return { month: mo, smSpend, newCustomers: n, cac: n > 0 ? smSpend / n : null }
  })
}

/** Trailing blended CAC over the last `window` reported months (denoises single months). */
export function blendedCac(series: CacPoint[], window = 3): number | null {
  const tail = series.slice(-window)
  const spend = tail.reduce((s, p) => s + p.smSpend, 0)
  const n = tail.reduce((s, p) => s + p.newCustomers, 0)
  return n > 0 ? spend / n : null
}

/** Months of gross profit to recover CAC. */
export function cacPaybackMonths(cac: number, arpaMonthly: number, grossMargin: number): number | null {
  const monthlyGp = arpaMonthly * grossMargin
  return monthlyGp > 0 ? cac / monthlyGp : null
}

/**
 * Magic Number = net new ARR in a quarter / S&M spend of the prior quarter.
 * Uses the last 3 reported-spend months as "prior quarter" and the 3 months after as the ARR window.
 */
export function magicNumber(m: Matrix, spend: SpendRow[]): number | null {
  const sm = spendByMonth(spend, ['marketing', 'sales'])
  const spendMonths = [...sm.keys()].sort()
  if (spendMonths.length < 3) return null
  const last = m.months[m.months.length - 1]
  // prior quarter = 3 consecutive spend months ending 3 months before the latest revenue month
  const qEnd = addMonths(last, -3)
  const q = [addMonths(qEnd, -2), addMonths(qEnd, -1), qEnd]
  if (!q.every((mo) => sm.has(mo))) return null
  const spendQ = q.reduce((s, mo) => s + (sm.get(mo) ?? 0), 0)
  if (spendQ <= 0) return null
  const netNewArr = (mrrOf(m, last) - mrrOf(m, qEnd)) * 12
  return netNewArr / spendQ
}

/**
 * Rule of 40 ≈ YoY revenue growth % + operating margin %, where operating margin
 * uses ALL uploaded spend as the cost base — an approximation unless the upload
 * includes every cost (use category 'other' for non-S&M costs).
 */
export function ruleOf40(m: Matrix, spend: SpendRow[]): { growth: number; margin: number; score: number } | null {
  const all = spendByMonth(spend)
  const last = m.months[m.months.length - 1]
  const yearAgo = addMonths(last, -12)
  if (monthDiff(m.months[0], yearAgo) < 0) return null
  // trailing-12-month window; only months with reported spend count toward costs
  const window = m.months.filter((mo) => monthDiff(mo, last) >= 0 && monthDiff(yearAgo, mo) > 0)
  const spendMonths = window.filter((mo) => all.has(mo))
  if (!spendMonths.length) return null
  const rev = window.reduce((s, mo) => s + mrrOf(m, mo), 0)
  const revYearAgo = m.months.filter((mo) => monthDiff(mo, yearAgo) >= 0 && monthDiff(addMonths(yearAgo, -12), mo) > 0)
    .reduce((s, mo) => s + mrrOf(m, mo), 0)
  if (rev <= 0 || revYearAgo <= 0) return null
  // scale costs to the full window when spend covers only part of it
  const costs = spendMonths.reduce((s, mo) => s + (all.get(mo) ?? 0), 0) * (window.length / spendMonths.length)
  const growth = rev / revYearAgo - 1
  const margin = (rev - costs) / rev
  return { growth, margin, score: growth + margin }
}
