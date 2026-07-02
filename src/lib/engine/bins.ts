import type { BinDef, Matrix } from '../types'
import { get, mrrOf } from './matrix'

export type BinRow = {
  label: string
  customers: number
  revenue: number
  share: number
  avgMrr: number
  avgAcv: number
}
export type BinResult = { month: string; total: number; bins: BinRow[] }

function pick(value: number, bins: BinDef[]): number {
  // (min, max]; open top when max === null
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i]
    const aboveMin = value > b.min
    const belowMax = b.max === null ? true : value <= b.max
    if (aboveMin && belowMax) return i
  }
  return -1
}

export function binAnalysis(m: Matrix, month: string, defs: BinDef[]): BinResult {
  const sums = defs.map(() => 0)
  const counts = defs.map(() => 0)
  for (const c of m.customers) {
    const v = get(m, c, month)
    if (v === 0) continue // only active customers
    const idx = pick(v, defs)
    if (idx >= 0) { sums[idx] += v; counts[idx] += 1 }
  }
  const total = mrrOf(m, month)
  const bins: BinRow[] = defs.map((d, i) => {
    const avgMrr = counts[i] ? sums[i] / counts[i] : 0
    return {
      label: d.label,
      customers: counts[i],
      revenue: sums[i],
      share: total ? sums[i] / total : 0,
      avgMrr,
      avgAcv: avgMrr * 12,
    }
  })
  return { month, total, bins }
}

/** Bin analysis for every month in the matrix (month-wise trend). */
export function binSeries(m: Matrix, defs: BinDef[]): BinResult[] {
  return m.months.map((mo) => binAnalysis(m, mo, defs))
}
