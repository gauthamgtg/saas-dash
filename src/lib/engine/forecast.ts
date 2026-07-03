import type { Matrix } from '../types'
import { mrrOf } from './matrix'
import { addMonths } from '../types'

export type ForecastPoint = { month: string; projected: number; lo: number; hi: number }

/**
 * Trailing-CMGR MRR projection with a widening uncertainty cone.
 * Honest run-rate extrapolation only — NOT scenario/P&L forecasting (no cost data).
 * Returns [] when there isn't enough positive history to fit a rate.
 */
export function mrrForecast(m: Matrix, ahead = 6, lookback = 6): ForecastPoint[] {
  const months = m.months
  const n = months.length
  if (n < 2) return []
  const k = Math.min(lookback, n - 1)
  const base = mrrOf(m, months[n - 1])
  const past = mrrOf(m, months[n - 1 - k])
  if (base <= 0 || past <= 0) return []
  const g = Math.pow(base / past, 1 / k) - 1 // trailing compound monthly growth
  const out: ForecastPoint[] = []
  for (let i = 1; i <= ahead; i++) {
    const proj = base * Math.pow(1 + g, i)
    const spread = 0.03 * i // cone widens ~3%/month
    out.push({ month: addMonths(months[n - 1], i), projected: Math.round(proj), lo: Math.round(proj * (1 - spread)), hi: Math.round(proj * (1 + spread)) })
  }
  return out
}
