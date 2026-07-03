import type { Matrix } from '../types'
import { mrrOf } from './matrix'
import { newLogosSeries } from './trends'
import { movementSeries } from './movement'

export type TimelineMarker = { month: string; label: string }

const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]

/** A few notable months to annotate on the MRR timeline: best acquisition month, worst churn month, biggest MRR milestone crossed. */
export function timelineMarkers(m: Matrix, reactivationGapK = 1): TimelineMarker[] {
  if (m.months.length < 2) return []
  const out: TimelineMarker[] = []
  const seen = new Set<string>()
  const add = (month: string, label: string) => { if (month && !seen.has(month)) { seen.add(month); out.push({ month, label }) } }

  const nl = newLogosSeries(m)
  const bestNew = nl.reduce((a, b) => (b.newLogos > a.newLogos ? b : a), nl[0])
  if (bestNew && bestNew.newLogos > 0) add(bestNew.month, `▲ ${bestNew.newLogos} new`)

  const mv = movementSeries(m, { reactivationGapK })
  const worst = mv.reduce((a, b) => (b.churn > a.churn ? b : a), mv[0])
  if (worst && worst.churn > 0) add(worst.month, 'churn spike')

  // highest MRR milestone crossed, at the first month it was exceeded
  let best: { threshold: number; month: string } | null = null
  for (const mo of m.months) {
    const v = mrrOf(m, mo)
    for (const t of MILESTONES) if (v >= t && (!best || t > best.threshold)) best = { threshold: t, month: mo }
  }
  if (best) {
    const firstMonth = m.months.find((mo) => mrrOf(m, mo) >= best!.threshold)
    if (firstMonth) add(firstMonth, `$${Math.round(best.threshold / 1000)}k MRR`)
  }
  return out
}
