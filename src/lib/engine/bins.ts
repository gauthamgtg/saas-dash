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

export type SankeyGraph = { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] }

/**
 * Customer flow between revenue bins from one month to the next (a feasible proxy for a
 * plan-migration Sankey — we have no plan IDs). Adds "Newly active" sources and "Churned" targets.
 */
export function binMigration(m: Matrix, defs: BinDef[], fromMonth: string, toMonth: string): SankeyGraph {
  const nodes: { name: string }[] = []
  const idx = new Map<string, number>()
  const node = (side: 'L' | 'R', label: string) => {
    const k = `${side}:${label}`
    if (!idx.has(k)) { idx.set(k, nodes.length); nodes.push({ name: label }) }
    return idx.get(k)!
  }
  const counts = new Map<string, number>()
  for (const c of m.customers) {
    const vf = get(m, c, fromMonth), vt = get(m, c, toMonth)
    const bf = vf > 0 ? pick(vf, defs) : -1
    const bt = vt > 0 ? pick(vt, defs) : -1
    if (bf < 0 && bt < 0) continue
    const src = node('L', bf >= 0 ? defs[bf].label : 'Newly active')
    const tgt = node('R', bt >= 0 ? defs[bt].label : 'Churned')
    const key = `${src}|${tgt}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const links = [...counts.entries()].map(([k, value]) => {
    const [source, target] = k.split('|').map(Number)
    return { source, target, value }
  })
  return { nodes, links }
}
