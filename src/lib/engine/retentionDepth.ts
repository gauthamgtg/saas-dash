import type { Matrix, Transaction } from '../types'
import { get, mrrOf } from './matrix'
import { addMonths, monthDiff } from '../types'
import type { Movement } from './movement'
import { atRisk } from './customers'
import { cohorts } from './cohorts'

/** Average gross + net retention curves across cohorts (by age month). */
export function avgRetentionCurves(m: Matrix, maxAge = 12): {
  age: number
  gross: number | null
  net: number | null
  logo: number | null
  n: number
}[] {
  const all = cohorts(m)
  const out: { age: number; gross: number | null; net: number | null; logo: number | null; n: number }[] = []
  for (let age = 0; age <= maxAge; age++) {
    const g: number[] = [], n: number[] = [], l: number[] = []
    for (const c of all) {
      if (c.netRetention.length > age) {
        g.push(c.grossRetention[age])
        n.push(c.netRetention[age])
        l.push(c.logoSurvival[age])
      }
    }
    const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)
    out.push({ age, gross: avg(g), net: avg(n), logo: avg(l), n: g.length })
  }
  return out
}

/** Early-life logo churn: share of a cohort lost within `windowMonths`. */
export function earlyLifeChurn(m: Matrix, windowMonths = 3): { cohortMonth: string; size: number; lost: number; rate: number }[] {
  const last = m.months[m.months.length - 1]
  const out: { cohortMonth: string; size: number; lost: number; rate: number }[] = []
  for (const c of cohorts(m)) {
    if (monthDiff(c.cohortMonth, last) < windowMonths) continue
    const age = windowMonths
    const survival = c.logoSurvival[age] ?? 1
    const lost = Math.round(c.size * (1 - survival))
    out.push({ cohortMonth: c.cohortMonth, size: c.size, lost, rate: 1 - survival })
  }
  return out.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
}

/** Median months from first active to first zero (churn), among customers who churned. */
export function timeToChurnMonths(m: Matrix): number | null {
  const gaps: number[] = []
  for (const c of m.customers) {
    let first: string | null = null
    let churned: string | null = null
    let sawActive = false
    for (const mo of m.months) {
      const v = get(m, c, mo)
      if (v > 0) {
        if (!first) first = mo
        sawActive = true
        churned = null
      } else if (sawActive && first && !churned) {
        churned = mo
      }
    }
    if (first && churned) gaps.push(monthDiff(first, churned))
  }
  if (!gaps.length) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
}

/** Win-backs by acquisition cohort month. */
export function winBackByCohort(m: Matrix): { cohortMonth: string; churned: number; wonBack: number; rate: number }[] {
  const first = new Map<string, string>()
  for (const c of m.customers) {
    for (const mo of m.months) {
      if (get(m, c, mo) > 0) { first.set(c, mo); break }
    }
  }
  const by = new Map<string, { churned: number; wonBack: number }>()
  for (const c of m.customers) {
    const cm = first.get(c)
    if (!cm) continue
    let sawActive = false, sawZero = false, reactivated = false
    for (const mo of m.months) {
      const v = get(m, c, mo)
      if (v > 0) {
        if (sawZero) reactivated = true
        sawActive = true
      } else if (sawActive) sawZero = true
    }
    if (!sawZero) continue
    const row = by.get(cm) ?? { churned: 0, wonBack: 0 }
    row.churned++
    if (reactivated) row.wonBack++
    by.set(cm, row)
  }
  return [...by.entries()].map(([cohortMonth, v]) => ({
    cohortMonth, ...v, rate: v.churned ? v.wonBack / v.churned : 0,
  })).sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
}

/** Logo churn vs revenue-weighted churn by dimension (plan / region / model). */
export function churnSplitByDimension(
  m: Matrix,
  txs: Transaction[],
  dim: 'plan' | 'region' | 'businessModel',
  start: string,
  end: string,
): { key: string; logoChurn: number | null; revenueChurn: number | null; openingMrr: number; logos: number }[] {
  const attr = new Map<string, string>()
  for (const t of txs) {
    const v = (t[dim] ?? 'Unknown') as string
    attr.set(t.customerId, v)
  }
  const groups = new Map<string, string[]>()
  for (const c of m.customers) {
    if (get(m, c, start) <= 0) continue
    const key = attr.get(c) ?? 'Unknown'
    const g = groups.get(key) ?? []
    g.push(c)
    groups.set(key, g)
  }
  return [...groups.entries()].map(([key, members]) => {
    const opening = members.reduce((s, c) => s + get(m, c, start), 0)
    const lostLogos = members.filter((c) => get(m, c, end) === 0)
    const lostRev = lostLogos.reduce((s, c) => s + get(m, c, start), 0)
    return {
      key,
      logos: members.length,
      openingMrr: opening,
      logoChurn: members.length ? lostLogos.length / members.length : null,
      revenueChurn: opening ? lostRev / opening : null,
    }
  }).sort((a, b) => b.openingMrr - a.openingMrr)
}

/** Movement mix as share of inflow/outflow for the latest month. */
export function movementMix(series: Movement[]): {
  month: string
  inflow: { new: number; expansion: number; reactivation: number; total: number }
  outflow: { contraction: number; churn: number; total: number }
  shares: { new: number; expansion: number; reactivation: number; contraction: number; churn: number }
} | null {
  const last = series[series.length - 1]
  if (!last) return null
  const inflow = last.newMrr + last.expansion + last.reactivation
  const outflow = last.contraction + last.churn
  const pct = (n: number, d: number) => (d > 0 ? n / d : 0)
  return {
    month: last.month,
    inflow: { new: last.newMrr, expansion: last.expansion, reactivation: last.reactivation, total: inflow },
    outflow: { contraction: last.contraction, churn: last.churn, total: outflow },
    shares: {
      new: pct(last.newMrr, inflow),
      expansion: pct(last.expansion, inflow),
      reactivation: pct(last.reactivation, inflow),
      contraction: pct(last.contraction, outflow),
      churn: pct(last.churn, outflow),
    },
  }
}

/** Series of mix % over time. */
export function movementMixSeries(series: Movement[]): {
  month: string
  newShare: number
  expansionShare: number
  reactivationShare: number
  contractionShare: number
  churnShare: number
}[] {
  return series.map((s) => {
    const inflow = s.newMrr + s.expansion + s.reactivation || 1
    const outflow = s.contraction + s.churn || 1
    return {
      month: s.month,
      newShare: s.newMrr / inflow,
      expansionShare: s.expansion / inflow,
      reactivationShare: s.reactivation / inflow,
      contractionShare: s.contraction / outflow,
      churnShare: s.churn / outflow,
    }
  })
}

/** Expansion MRR rate = expansion / opening MRR. */
export function expansionRate(series: Movement[], openingMrr: number): number | null {
  if (openingMrr <= 0 || !series.length) return null
  return series[series.length - 1].expansion / openingMrr
}

/** LTV with net retention expansion: ARPA * GM * (NRR / monthly logo-churn proxy). */
export function ltvWithExpansion(arpaMonthly: number, grossMargin: number, monthlyNrr: number, monthlyLogoChurn: number): number | null {
  if (monthlyLogoChurn <= 0) return null
  // Effective lifetime stretched by net retention > 1
  const lift = Math.max(monthlyNrr, 0.01)
  return (arpaMonthly * grossMargin * lift) / monthlyLogoChurn
}
