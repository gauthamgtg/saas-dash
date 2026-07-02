import type { Matrix } from '../types'
import type { Movement } from './movement'
import { get, mrrOf, activeCustomers } from './matrix'
import { addMonths, monthDiff } from '../types'

export function arr(m: Matrix, month: string): number {
  return mrrOf(m, month) * 12
}

export function arpa(m: Matrix, month: string): number | null {
  const n = activeCustomers(m, month)
  return n ? mrrOf(m, month) / n : null
}

export function momGrowth(m: Matrix, month: string): number | null {
  const prev = mrrOf(m, addMonths(month, -1))
  return prev ? (mrrOf(m, month) - prev) / prev : null
}

export function yoyGrowth(m: Matrix, month: string): number | null {
  const yearAgo = addMonths(month, -12)
  if (monthDiff(m.months[0], yearAgo) < 0) return null // insufficient history
  const prev = mrrOf(m, yearAgo)
  return prev ? (mrrOf(m, month) - prev) / prev : null
}

/** Cohort of customers active at `start`; retention to `end`. */
function startCohort(m: Matrix, start: string): string[] {
  return m.customers.filter((c) => get(m, c, start) > 0)
}

export function nrr(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  const base = cohort.reduce((s, c) => s + get(m, c, start), 0)
  if (!base) return null
  const now = cohort.reduce((s, c) => s + get(m, c, end), 0)
  return now / base
}

export function grr(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  const base = cohort.reduce((s, c) => s + get(m, c, start), 0)
  if (!base) return null
  const now = cohort.reduce((s, c) => s + Math.min(get(m, c, end), get(m, c, start)), 0)
  return now / base
}

export function logoChurnRate(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  if (!cohort.length) return null
  const lost = cohort.filter((c) => get(m, c, end) === 0).length
  return lost / cohort.length
}

/** Expected lifespan in months = 1 / monthly churn rate. */
export function avgLifetimeMonths(monthlyChurnRate: number): number | null {
  return monthlyChurnRate > 0 ? 1 / monthlyChurnRate : null
}

/** Revenue LTV = ARPA * grossMargin / monthlyChurnRate. */
export function ltvRevenue(arpaMonthly: number, grossMargin: number, monthlyChurnRate: number): number | null {
  return monthlyChurnRate > 0 ? (arpaMonthly * grossMargin) / monthlyChurnRate : null
}

/** SaaS quick ratio over a movement series: (new+expansion+reactivation)/(churn+contraction). */
export function quickRatio(series: Movement[]): number | null {
  let inflow = 0, outflow = 0
  for (const s of series) {
    inflow += s.newMrr + s.expansion + s.reactivation
    outflow += s.churn + s.contraction
  }
  return outflow > 0 ? inflow / outflow : null
}

/** Compound monthly growth rate of MRR from the first to the last month. */
export function cmgr(m: Matrix): number | null {
  if (m.months.length < 2) return null
  const start = mrrOf(m, m.months[0])
  const end = mrrOf(m, m.months[m.months.length - 1])
  const n = monthDiff(m.months[0], m.months[m.months.length - 1])
  if (start <= 0 || n < 1) return null
  return Math.pow(end / start, 1 / n) - 1
}

/** New = each customer's first-active-month revenue; Repeat = everything after. */
export function newVsRepeatRevenue(m: Matrix): { newRevenue: number; repeatRevenue: number } {
  let newRevenue = 0, total = 0
  for (const c of m.customers) {
    let seenFirst = false
    for (const mo of m.months) {
      const v = get(m, c, mo)
      total += v
      if (v > 0 && !seenFirst) { newRevenue += v; seenFirst = true }
    }
  }
  return { newRevenue, repeatRevenue: total - newRevenue }
}
