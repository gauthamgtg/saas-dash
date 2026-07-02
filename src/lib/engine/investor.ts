import type { Matrix } from '../types'
import { get, mrrOf } from './matrix'
import { monthDiff, addMonths } from '../types'

/**
 * T2D3 trajectory: year-over-year ARR multiples vs the [3,3,2,2,2] benchmark.
 * Year 0 = the matrix's first month; each subsequent 12-month step compared.
 */
export function t2d3(m: Matrix): { year: number; arr: number; multiple: number | null; target: number; onTrack: boolean | null }[] {
  if (m.months.length < 24) return [] // needs ≥2 years of history (spec §9)
  const targets = [3, 3, 2, 2, 2]
  const out: { year: number; arr: number; multiple: number | null; target: number; onTrack: boolean | null }[] = []
  const start = m.months[0]
  const totalMonths = monthDiff(start, m.months[m.months.length - 1])
  const years = Math.floor(totalMonths / 12)
  for (let y = 0; y <= years; y++) {
    const mo = addMonths(start, y * 12)
    const arr = mrrOf(m, mo) * 12
    if (y === 0) { out.push({ year: y, arr, multiple: null, target: NaN, onTrack: null }); continue }
    const prevArr = mrrOf(m, addMonths(start, (y - 1) * 12)) * 12
    const multiple = prevArr > 0 ? arr / prevArr : null
    const target = targets[Math.min(y - 1, targets.length - 1)]
    out.push({ year: y, arr, multiple, target, onTrack: multiple == null ? null : multiple >= target })
  }
  return out
}

/**
 * Revenue-weighted (logo-loss) churn: share of start-cohort MRR lost to customers
 * who dropped fully to zero by `end` (excludes downgrades). Pair with logo churn.
 */
export function revenueWeightedChurn(m: Matrix, start: string, end: string): number | null {
  const cohort = m.customers.filter((c) => get(m, c, start) > 0)
  const base = cohort.reduce((s, c) => s + get(m, c, start), 0)
  if (!base) return null
  const lost = cohort.filter((c) => get(m, c, end) === 0).reduce((s, c) => s + get(m, c, start), 0)
  return lost / base
}
