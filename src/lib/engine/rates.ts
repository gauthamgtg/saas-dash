import type { Matrix } from '../types'
import type { Movement } from './movement'
import { get, mrrOf } from './matrix'
import { nrr } from './kpis'
import { addMonths, monthDiff } from '../types'

/** Contraction rate = contraction MRR / opening MRR for the period. */
export function contractionRate(series: Movement[], openingMrr: number): number | null {
  if (openingMrr <= 0 || !series.length) return null
  const last = series[series.length - 1]
  return last.contraction / openingMrr
}

/** Reactivation rate = reactivation MRR / opening MRR for the period. */
export function reactivationRate(series: Movement[], openingMrr: number): number | null {
  if (openingMrr <= 0 || !series.length) return null
  const last = series[series.length - 1]
  return last.reactivation / openingMrr
}

/** Net-negative churn when NRR > 100% (expansion more than offsets logo/revenue loss). */
export function netNegativeChurn(m: Matrix, start: string, end: string): boolean | null {
  const r = nrr(m, start, end)
  return r == null ? null : r > 1
}

/**
 * Growth persistence: share of months in the trailing window with positive MoM MRR growth.
 * Higher = steadier climb (vs volatile spikes).
 */
export function growthPersistence(m: Matrix, window = 12): number | null {
  if (m.months.length < 2) return null
  const start = Math.max(1, m.months.length - window)
  let up = 0, n = 0
  for (let i = start; i < m.months.length; i++) {
    const cur = mrrOf(m, m.months[i])
    const prev = mrrOf(m, m.months[i - 1])
    if (prev <= 0) continue
    n++
    if (cur > prev) up++
  }
  return n ? up / n : null
}

/** Distinct Payment IDs / distinct Invoice Numbers — invoice split ratio. */
export function invoiceSplitRatio(paymentIds: (string | null)[], invoiceNumbers: (string | null)[]): number | null {
  const pays = new Set(paymentIds.filter(Boolean))
  const invs = new Set(invoiceNumbers.filter(Boolean))
  return invs.size ? pays.size / invs.size : null
}

/** Concentration risk: top N% of customers ≥ threshold of revenue, or HHI above warn. */
export function concentrationRisk(topShare: number, hhi: number, topShareWarn = 0.4, hhiWarn = 0.25): {
  flagged: boolean
  reason: string | null
} {
  if (topShare >= topShareWarn) return { flagged: true, reason: `Top accounts hold ${Math.round(topShare * 100)}% of revenue` }
  if (hhi >= hhiWarn) return { flagged: true, reason: `HHI ${hhi.toFixed(2)} signals high concentration` }
  return { flagged: false, reason: null }
}

/** Win-back rate: share of churned logos that later reactivated (lifetime in matrix). */
export function winBackRate(m: Matrix): number | null {
  let churned = 0, won = 0
  for (const c of m.customers) {
    let sawActive = false, sawZero = false, reactivated = false
    for (const mo of m.months) {
      const v = get(m, c, mo)
      if (v > 0) {
        if (sawZero) reactivated = true
        sawActive = true
      } else if (sawActive) {
        sawZero = true
      }
    }
    if (sawZero) {
      churned++
      if (reactivated) won++
    }
  }
  return churned ? won / churned : null
}

/** Months of history available (for YoY / T2D3 gating in UI). */
export function monthsOfHistory(m: Matrix): number {
  if (m.months.length < 2) return m.months.length
  return monthDiff(m.months[0], m.months[m.months.length - 1]) + 1
}

/** Scenario MRR paths from a base monthly growth rate. */
export function scenarioForecast(
  baseMrr: number,
  lastMonth: string,
  rates: { bear: number; base: number; bull: number },
  ahead = 12,
): { month: string; bear: number; base: number; bull: number }[] {
  if (baseMrr <= 0 || !lastMonth) return []
  const out: { month: string; bear: number; base: number; bull: number }[] = []
  for (let i = 1; i <= ahead; i++) {
    out.push({
      month: addMonths(lastMonth, i),
      bear: Math.round(baseMrr * Math.pow(1 + rates.bear, i)),
      base: Math.round(baseMrr * Math.pow(1 + rates.base, i)),
      bull: Math.round(baseMrr * Math.pow(1 + rates.bull, i)),
    })
  }
  return out
}
