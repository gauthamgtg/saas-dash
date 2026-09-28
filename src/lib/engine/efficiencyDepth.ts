import type { Matrix } from '../types'
import type { SpendRow } from '../spend'
import type { PipelineDeal } from '../pipeline'
import { get, mrrOf } from './matrix'
import { addMonths, monthDiff } from '../types'
import { newCustomersByMonth, spendByMonth, cacSeries } from './unitEconomics'
import { summarizePipeline } from '../pipeline'
import { nrr, arpa, grr, logoChurnRate } from './kpis'
import { ltvWithExpansion } from './retentionDepth'

/** CAC by marketing/sales channel (blended over months where that channel has spend). */
export function cacByChannel(m: Matrix, spend: SpendRow[]): {
  channel: string
  smSpend: number
  // attributed approx: channel share of S&M × new customers
  estimatedNew: number
  cac: number | null
}[] {
  const sm = spend.filter((r) => r.category === 'marketing' || r.category === 'sales')
  const byCh = new Map<string, number>()
  let total = 0
  for (const r of sm) {
    byCh.set(r.channel, (byCh.get(r.channel) ?? 0) + r.amount)
    total += r.amount
  }
  const fresh = [...newCustomersByMonth(m).values()].reduce((s, n) => s + n, 0)
  if (!total || !fresh) {
    return [...byCh.entries()].map(([channel, smSpend]) => ({ channel, smSpend, estimatedNew: 0, cac: null }))
  }
  return [...byCh.entries()]
    .map(([channel, smSpend]) => {
      const estimatedNew = fresh * (smSpend / total)
      return { channel, smSpend, estimatedNew, cac: estimatedNew > 0 ? smSpend / estimatedNew : null }
    })
    .sort((a, b) => b.smSpend - a.smSpend)
}

/** Cohort CAC payback: spend in cohort month / first-month GP of that cohort. */
export function cohortCacPayback(m: Matrix, spend: SpendRow[], grossMargin: number): {
  cohortMonth: string
  newCustomers: number
  smSpend: number
  cac: number | null
  firstMonthArpa: number | null
  paybackMonths: number | null
}[] {
  const sm = spendByMonth(spend, ['marketing', 'sales'])
  const fresh = newCustomersByMonth(m)
  const out: {
    cohortMonth: string
    newCustomers: number
    smSpend: number
    cac: number | null
    firstMonthArpa: number | null
    paybackMonths: number | null
  }[] = []

  for (const mo of m.months) {
    if (!sm.has(mo)) continue
    const n = fresh.get(mo) ?? 0
    const smSpend = sm.get(mo) ?? 0
    const cac = n > 0 ? smSpend / n : null
    // first-month ARPA of customers acquired that month
    let rev = 0, cnt = 0
    for (const c of m.customers) {
      let first: string | null = null
      for (const x of m.months) {
        if (get(m, c, x) > 0) { first = x; break }
      }
      if (first === mo) {
        rev += get(m, c, mo)
        cnt++
      }
    }
    const firstMonthArpa = cnt ? rev / cnt : null
    const gp = firstMonthArpa != null ? firstMonthArpa * grossMargin : null
    out.push({
      cohortMonth: mo,
      newCustomers: n,
      smSpend,
      cac,
      firstMonthArpa,
      paybackMonths: cac != null && gp && gp > 0 ? cac / gp : null,
    })
  }
  return out
}

/** Sales efficiency = net new ARR in window / S&M spend in window. */
export function salesEfficiency(m: Matrix, spend: SpendRow[], windowMonths = 3): number | null {
  if (!m.months.length) return null
  const sm = spendByMonth(spend, ['marketing', 'sales'])
  const last = m.months[m.months.length - 1]
  const start = addMonths(last, -(windowMonths - 1))
  const open = addMonths(start, -1)
  const months = m.months.filter((mo) => monthDiff(start, mo) >= 0 && monthDiff(mo, last) >= 0)
  const withSpend = months.filter((mo) => sm.has(mo))
  if (!withSpend.length) return null
  const spendSum = withSpend.reduce((s, mo) => s + (sm.get(mo) ?? 0), 0)
  if (spendSum <= 0) return null
  const netNewArr = (mrrOf(m, last) - mrrOf(m, open)) * 12
  return netNewArr / spendSum
}

/** Paid vs organic proxy: channels tagged 'organic'/'seo'/'content' vs rest of S&M. */
export function paidVsOrganicCac(m: Matrix, spend: SpendRow[]): {
  paidSpend: number
  organicSpend: number
  paidCac: number | null
  organicCac: number | null
} {
  const organicRe = /organic|seo|content|referral|word.?of.?mouth/i
  let paidSpend = 0, organicSpend = 0
  for (const r of spend) {
    if (r.category !== 'marketing' && r.category !== 'sales') continue
    if (organicRe.test(r.channel)) organicSpend += r.amount
    else paidSpend += r.amount
  }
  const totalSm = paidSpend + organicSpend || 1
  const series = cacSeries(m, spend)
  const totalNew = series.reduce((s, p) => s + p.newCustomers, 0)
  const paidNew = totalNew * (paidSpend / totalSm)
  const orgNew = totalNew * (organicSpend / totalSm)
  return {
    paidSpend,
    organicSpend,
    paidCac: paidNew > 0 ? paidSpend / paidNew : null,
    organicCac: orgNew > 0 ? organicSpend / orgNew : null,
  }
}

export function expansionLtvSummary(m: Matrix, grossMargin: number): {
  arpa: number | null
  monthlyNrr: number | null
  monthlyChurn: number | null
  classicLtv: number | null
  expansionLtv: number | null
} {
  if (m.months.length < 2) {
    return { arpa: null, monthlyNrr: null, monthlyChurn: null, classicLtv: null, expansionLtv: null }
  }
  const last = m.months[m.months.length - 1]
  const prev = m.months[m.months.length - 2]
  const a = arpa(m, last)
  const monthlyNrr = nrr(m, prev, last)
  const monthlyChurn = logoChurnRate(m, prev, last)
  const classicLtv = a != null && monthlyChurn && monthlyChurn > 0 ? (a * grossMargin) / monthlyChurn : null
  const expansionLtv = a != null && monthlyNrr != null && monthlyChurn && monthlyChurn > 0
    ? ltvWithExpansion(a, grossMargin, monthlyNrr, monthlyChurn)
    : null
  return { arpa: a, monthlyNrr, monthlyChurn, classicLtv, expansionLtv }
}

/**
 * Bottom-up MRR forecast:
 * retained base (× NRR) + weighted open pipeline / 12 as new MRR, for `ahead` months.
 */
export function bottomUpForecast(
  m: Matrix,
  deals: PipelineDeal[],
  ahead = 12,
): { month: string; retained: number; pipelineNew: number; total: number }[] {
  if (!m.months.length) return []
  const last = m.months[m.months.length - 1]
  let base = mrrOf(m, last)
  const prev = m.months.length > 1 ? m.months[m.months.length - 2] : last
  const monthlyNrr = nrr(m, prev, last) ?? 0.98
  const summary = summarizePipeline(deals)
  // Spread weighted open pipeline evenly over ahead months as new MRR (ACV/12)
  const monthlyPipe = (summary.weightedPipeline / 12) / Math.max(ahead, 1)

  const out: { month: string; retained: number; pipelineNew: number; total: number }[] = []
  for (let i = 1; i <= ahead; i++) {
    const retained = base * monthlyNrr
    const pipelineNew = monthlyPipe
    const total = retained + pipelineNew
    out.push({ month: addMonths(last, i), retained: Math.round(retained), pipelineNew: Math.round(pipelineNew), total: Math.round(total) })
    base = total
  }
  return out
}

/** Pipeline coverage = weighted open / ARR target (or trailing ARR). */
export function pipelineCoverage(deals: PipelineDeal[], arrTarget: number): number | null {
  if (arrTarget <= 0) return null
  return summarizePipeline(deals).weightedPipeline / arrTarget
}

void grr
