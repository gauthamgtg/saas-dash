import type { Transaction } from '../types'
import type { Matrix } from '../types'
import type { SpendRow } from '../spend'
import { mrrOf } from './matrix'
import { addMonths, monthDiff } from '../types'
import { ruleOf40 } from './unitEconomics'
import { spendByMonth } from './unitEconomics'

/** One-time vs recurring proxy from businessModel / plan labels. */
export function recurringSplit(txs: Transaction[]): {
  recurring: number
  oneTime: number
  recurringShare: number
} {
  let recurring = 0, oneTime = 0
  const oneRe = /one.?time|setup|services|professional|implem|consult/i
  for (const t of txs) {
    if (t.isRefund) continue
    const label = `${t.businessModel ?? ''} ${t.plan ?? ''}`
    if (oneRe.test(label)) oneTime += t.amountBase
    else recurring += t.amountBase
  }
  const total = recurring + oneTime || 1
  return { recurring, oneTime, recurringShare: recurring / total }
}

/** Rule of 40 score per trailing window ending each month (needs ≥12 mo + spend). */
export function ruleOf40Trend(m: Matrix, spend: SpendRow[]): { month: string; score: number | null; growth: number | null; margin: number | null }[] {
  // Approximate: for each end month with enough history, slice months and spend
  const out: { month: string; score: number | null; growth: number | null; margin: number | null }[] = []
  for (let i = 0; i < m.months.length; i++) {
    const end = m.months[i]
    if (monthDiff(m.months[0], end) < 12) {
      out.push({ month: end, score: null, growth: null, margin: null })
      continue
    }
    // Build a tiny fake matrix view isn't easy — compute growth/margin inline like ruleOf40
    const yearAgo = addMonths(end, -12)
    const window = m.months.filter((mo) => monthDiff(mo, end) >= 0 && monthDiff(yearAgo, mo) > 0)
    const all = spendByMonth(spend)
    const spendMonths = window.filter((mo) => all.has(mo))
    if (!spendMonths.length) {
      out.push({ month: end, score: null, growth: null, margin: null })
      continue
    }
    const rev = window.reduce((s, mo) => s + mrrOf(m, mo), 0)
    const revYearAgo = mrrOf(m, yearAgo) // YoY run-rate growth, same basis as ruleOf40()
    if (rev <= 0 || revYearAgo <= 0) {
      out.push({ month: end, score: null, growth: null, margin: null })
      continue
    }
    const costs = spendMonths.reduce((s, mo) => s + (all.get(mo) ?? 0), 0) * (window.length / spendMonths.length)
    const growth = mrrOf(m, end) / revYearAgo - 1
    const margin = (rev - costs) / rev
    out.push({ month: end, score: growth + margin, growth, margin })
  }
  return out
}

void ruleOf40
