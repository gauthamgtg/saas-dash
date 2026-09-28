import type { Matrix } from '../types'
import type { Movement } from './movement'
import { mrrOf } from './matrix'
import { addMonths } from '../types'
import { arr, nrr, grr, logoChurnRate, momGrowth, yoyGrowth, cmgr, quickRatio } from './kpis'
import { revenueWeightedChurn } from './investor'

/** Standard board ARR / MRR bridge row set for a period. */
export type ArrBridge = {
  periodStart: string
  periodEnd: string
  openingMrr: number
  openingArr: number
  newMrr: number
  expansion: number
  reactivation: number
  contraction: number
  churn: number
  netNew: number
  closingMrr: number
  closingArr: number
  mom: number | null
  yoy: number | null
  nrr: number | null
  grr: number | null
  logoChurn: number | null
  rwChurn: number | null
}

export function arrBridge(m: Matrix, series: Movement[]): ArrBridge | null {
  const move = series[series.length - 1]
  if (!move || !move.prevMonth) return null
  const openingMrr = mrrOf(m, move.prevMonth)
  const closingMrr = mrrOf(m, move.month)
  return {
    periodStart: move.prevMonth,
    periodEnd: move.month,
    openingMrr,
    openingArr: openingMrr * 12,
    newMrr: move.newMrr,
    expansion: move.expansion,
    reactivation: move.reactivation,
    contraction: move.contraction,
    churn: move.churn,
    netNew: move.netNew,
    closingMrr,
    closingArr: closingMrr * 12,
    mom: momGrowth(m, move.month),
    yoy: yoyGrowth(m, move.month),
    nrr: nrr(m, move.prevMonth, move.month),
    grr: grr(m, move.prevMonth, move.month),
    logoChurn: logoChurnRate(m, move.prevMonth, move.month),
    rwChurn: revenueWeightedChurn(m, move.prevMonth, move.month),
  }
}

/** Multi-month ARR bridge table (each month a row). */
export function arrBridgeHistory(m: Matrix, series: Movement[]): {
  month: string
  opening: number
  newMrr: number
  expansion: number
  reactivation: number
  contraction: number
  churn: number
  closing: number
  netNew: number
}[] {
  return series.map((s) => ({
    month: s.month,
    opening: s.prevMonth ? mrrOf(m, s.prevMonth) : 0,
    newMrr: s.newMrr,
    expansion: s.expansion,
    reactivation: s.reactivation,
    contraction: s.contraction,
    churn: s.churn,
    closing: mrrOf(m, s.month),
    netNew: s.netNew,
  }))
}

/** Diligence one-pager metrics pack. */
export function diligencePack(m: Matrix, series: Movement[]) {
  const last = m.months[m.months.length - 1] ?? ''
  const prev = m.months.length > 1 ? m.months[m.months.length - 2] : addMonths(last, -1)
  return {
    mrr: mrrOf(m, last),
    arr: arr(m, last),
    cmgr: cmgr(m),
    quick: quickRatio(series.slice(-3)),
    nrr: nrr(m, prev, last),
    grr: grr(m, prev, last),
    logoChurn: logoChurnRate(m, prev, last),
    rwChurn: revenueWeightedChurn(m, prev, last),
    bridge: arrBridge(m, series),
  }
}
