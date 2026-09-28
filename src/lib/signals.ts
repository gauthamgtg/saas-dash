import type { Matrix, Transaction } from './types'
import { get } from './engine/matrix'
import { median } from './engine/stats'
import { fmtMoney, fmtPct } from './format'

/**
 * Account-level early-warning (churn) and expansion-radar scores.
 * ponytail: transparent weighted rules, not a trained model — every point of score maps to a
 * human-readable reason. The backtest below is how we check the rules actually predict anything;
 * swap in a fitted model only if the backtest lift stays weak on real data.
 */

export type Kind = 'churn' | 'expansion'
export type Tier = 'high' | 'medium' | 'low'
export type Signal = { key: string; label: string; weight: number; strength: number; points: number; reason: string }
export type AccountScore = {
  customerId: string; name: string; mrr: number; segment: string
  churn: number; expansion: number; churnTier: Tier; expansionTier: Tier
  churnSignals: Signal[]; expansionSignals: Signal[]; spark: number[]
}

/** Signal catalogue — also rendered in the UI's "How the score works" panel. */
export const WEIGHTS: Record<Kind, { key: string; label: string; weight: number; rule: string }[]> = {
  churn: [
    { key: 'overdue', label: 'Payment overdue', weight: 30, rule: 'Days since last payment vs its usual payment gap' },
    { key: 'momentum', label: 'Shrinking spend', weight: 25, rule: 'Last-3-month MRR vs the 3 months before' },
    { key: 'streak', label: 'Consecutive downgrades', weight: 15, rule: 'Months in a row of lower MRR' },
    { key: 'peak', label: 'Far below peak', weight: 10, rule: 'Current MRR vs its 12-month high' },
    { key: 'refunds', label: 'Refund activity', weight: 10, rule: 'Refunded share of spend, last 6 months' },
    { key: 'gaps', label: 'Skipped months', weight: 10, rule: 'Zero-revenue months in the last 6' },
  ],
  expansion: [
    { key: 'momentum', label: 'Growing spend', weight: 30, rule: 'Last-3-month MRR vs the 3 months before' },
    { key: 'streak', label: 'Consecutive increases', weight: 15, rule: 'Months in a row of higher MRR' },
    { key: 'frequency', label: 'More invoices', weight: 15, rule: 'Payments last 3 months vs the 3 before (usage / add-ons)' },
    { key: 'headroom', label: 'Room to grow', weight: 15, rule: 'Current MRR vs the top quartile of its segment' },
    { key: 'reliable', label: 'Tenured & on time', weight: 15, rule: '6+ months tenure, pays on schedule, no refunds' },
    { key: 'peak', label: 'At all-time high', weight: 10, rule: 'Current MRR at its 12-month peak' },
  ],
}
export const TIER_CUTS: Record<Kind, { high: number; medium: number }> = {
  churn: { high: 40, medium: 15 },
  expansion: { high: 45, medium: 25 },
}
const tierOf = (kind: Kind, s: number): Tier => (s >= TIER_CUTS[kind].high ? 'high' : s >= TIER_CUTS[kind].medium ? 'medium' : 'low')
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0)
const DAY = 864e5

/** Group transactions by customer once (per-account scoring would otherwise rescan everything). */
export function groupByCustomer(txs: Transaction[]): Map<string, Transaction[]> {
  const out = new Map<string, Transaction[]>()
  for (const t of txs) { const a = out.get(t.customerId); if (a) a.push(t); else out.set(t.customerId, [t]) }
  return out
}

/**
 * Score every account active in month index `at`, using only data up to that month.
 * `asOf` = the "today" for recency math (latest payment date for live scoring, month-end for backtests).
 */
export function scoreAccounts(m: Matrix, byCustomer: Map<string, Transaction[]>, at: number, asOf: Date): AccountScore[] {
  const month = m.months[at]
  if (!month) return []
  const win = (n: number) => m.months.slice(Math.max(0, at - n + 1), at + 1)
  const last3 = win(3), prev3 = m.months.slice(Math.max(0, at - 5), Math.max(0, at - 2)), last6 = win(6), last12 = win(12)

  // Candidates = paid this month OR last month: an account that hasn't paid yet this cycle is exactly
  // what an early warning should catch, not something to drop as already churned.
  const prevMonth = m.months[at - 1]
  const curOf = (c: string) => get(m, c, month) || (prevMonth ? get(m, c, prevMonth) : 0)
  const active = m.customers.filter((c) => curOf(c) > 0)
  // segment benchmark for "headroom": top-quartile current MRR per business model / plan
  const segOf = (c: string) => { const t = byCustomer.get(c)?.[0]; return t?.businessModel ?? t?.plan ?? 'All' }
  const segVals = new Map<string, number[]>()
  for (const c of active) { const s = segOf(c); segVals.set(s, [...(segVals.get(s) ?? []), curOf(c)]) }
  const p75 = new Map([...segVals].map(([s, v]) => { const a = [...v].sort((x, y) => x - y); return [s, a[Math.floor(0.75 * (a.length - 1))]] }))

  return active.map((c) => {
    const cur = curOf(c)
    const series = last12.map((mo) => get(m, c, mo))
    const a3 = mean(last3.map((mo) => get(m, c, mo))), p3 = mean(prev3.map((mo) => get(m, c, mo)))
    const trend = p3 > 0 ? a3 / p3 - 1 : null
    const peak = Math.max(...series)

    let down = 0, up = 0
    for (let i = series.length - 1; i > 0 && series[i] > 0 && series[i - 1] > 0 && series[i] < series[i - 1]; i--) down++
    for (let i = series.length - 1; i > 0 && series[i - 1] > 0 && series[i] > series[i - 1]; i--) up++

    const own = (byCustomer.get(c) ?? []).filter((t) => t.month <= month)
    const pays = own.filter((t) => t.amountBase > 0).map((t) => t.date.getTime()).sort((x, y) => x - y)
    const days = [...new Set(pays.map((p) => Math.floor(p / DAY)))]
    const gap = days.length >= 3 ? median(days.slice(1).map((d, i) => d - days[i])) : null
    const since = pays.length ? (asOf.getTime() - pays[pays.length - 1]) / DAY : null
    const overdue = gap && since != null ? since / gap : null

    const inWin = (mos: string[]) => own.filter((t) => mos.includes(t.month))
    const w6 = inWin(last6)
    const gross6 = w6.filter((t) => t.amountBase > 0).reduce((s, t) => s + t.amountBase, 0)
    const ref6 = w6.filter((t) => t.amountBase < 0).reduce((s, t) => s - t.amountBase, 0)
    const refundRate = gross6 ? ref6 / gross6 : 0
    const firstMo = m.months.findIndex((mo) => get(m, c, mo) !== 0)
    const tenure = at - firstMo + 1
    const gaps = last6.filter((mo) => m.months.indexOf(mo) > firstMo && get(m, c, mo) === 0).length
    const n3 = inWin(last3).filter((t) => t.amountBase > 0).length, np3 = inWin(prev3).filter((t) => t.amountBase > 0).length
    const seg = segOf(c), top = p75.get(seg) ?? 0

    const sig = (kind: Kind, key: string, strength: number, reason: string): Signal => {
      const w = WEIGHTS[kind].find((x) => x.key === key)!
      const s = clamp(strength)
      return { key, label: w.label, weight: w.weight, strength: s, points: Math.round(w.weight * s), reason }
    }

    const churnSignals = [
      sig('churn', 'overdue', overdue != null && overdue > 1.3 ? (overdue - 1) / 2 : 0, `Last paid ${Math.round(since ?? 0)}d ago — usually every ${Math.round(gap ?? 0)}d`),
      sig('churn', 'momentum', trend != null && trend < -0.08 ? -trend / 0.5 : 0, `MRR down ${fmtPct(-(trend ?? 0), 0)} vs prior quarter`),
      sig('churn', 'streak', down >= 2 ? down / 4 : 0, `${down} downgrades in a row`),
      sig('churn', 'peak', peak > 0 && cur / peak < 0.75 ? 1 - cur / peak : 0, `${fmtPct(1 - cur / (peak || 1), 0)} below 12-month peak of ${fmtMoney(peak)}`),
      sig('churn', 'refunds', refundRate > 0.03 ? refundRate / 0.25 : 0, `Refunded ${fmtPct(refundRate, 0)} of spend`),
      sig('churn', 'gaps', gaps / 3, `Skipped ${gaps} of the last 6 months`),
    ].filter((s) => s.points > 0).sort((a, b) => b.points - a.points)
    const churn = Math.min(100, churnSignals.reduce((s, x) => s + x.points, 0))

    const onTime = overdue == null || overdue <= 1.2
    const expansionSignals = [
      sig('expansion', 'momentum', trend != null && trend > 0.05 ? trend / 0.5 : 0, `MRR up ${fmtPct(trend ?? 0, 0)} vs prior quarter`),
      sig('expansion', 'streak', up >= 2 ? up / 4 : 0, `Grew ${up} months running`),
      sig('expansion', 'frequency', np3 > 0 && n3 > np3 ? (n3 - np3) / np3 : 0, `${n3} invoices last quarter vs ${np3} before`),
      sig('expansion', 'headroom', top > 0 && cur < top && (trend ?? 0) >= 0 ? 1 - cur / top : 0, `At ${fmtPct(cur / (top || 1), 0)} of ${seg} top-quartile spend (${fmtMoney(top)})`),
      sig('expansion', 'reliable', tenure >= 6 && onTime && refundRate === 0 ? Math.min(1, tenure / 12) : 0, `${tenure} months tenure, pays on time, no refunds`),
      sig('expansion', 'peak', up >= 1 && cur >= peak * 0.98 ? 1 : 0, 'MRR at its 12-month high'),
    ].filter((s) => s.points > 0).sort((a, b) => b.points - a.points)
    // an account flashing red isn't an upsell target: damp expansion by churn risk
    const expansion = Math.round(Math.min(100, expansionSignals.reduce((s, x) => s + x.points, 0)) * (1 - churn / 150))

    return {
      customerId: c, name: own.find((t) => t.name)?.name ?? c, mrr: cur, segment: seg,
      churn, expansion, churnTier: tierOf('churn', churn), expansionTier: tierOf('expansion', expansion),
      churnSignals, expansionSignals, spark: series,
    }
  })
}

export type Backtest = {
  month: string; horizon: number; baseline: number; tiers: { tier: Tier; n: number; hits: number; rate: number }[]
  flagged: { n: number; hits: number; rate: number }; lift: number | null
} | null

/**
 * Score accounts as of `horizon` months ago, then check what actually happened.
 * churn hit = MRR fell to 0 by the end month; expansion hit = MRR grew ≥ 10%.
 */
export function backtest(m: Matrix, byCustomer: Map<string, Transaction[]>, kind: Kind, horizon = 3): Backtest {
  const at = m.months.length - 1 - horizon
  if (at < 6) return null // need a quarter-over-quarter window before the scoring month
  const [y, mo] = m.months[at].split('-').map(Number)
  // month-end asOf; only accounts that actually paid in the scoring month, so already-gone accounts can't inflate hits
  const scored = scoreAccounts(m, byCustomer, at, new Date(y, mo, 0, 23, 59)).filter((a) => get(m, a.customerId, m.months[at]) > 0)
  const end = m.months[m.months.length - 1]
  const hit = (a: AccountScore) => (kind === 'churn' ? get(m, a.customerId, end) === 0 : get(m, a.customerId, end) >= a.mrr * 1.1)
  const tiers = (['high', 'medium', 'low'] as Tier[]).map((tier) => {
    const g = scored.filter((a) => (kind === 'churn' ? a.churnTier : a.expansionTier) === tier)
    const hits = g.filter(hit).length
    return { tier, n: g.length, hits, rate: g.length ? hits / g.length : 0 }
  })
  const baseline = scored.length ? scored.filter(hit).length / scored.length : 0
  // lift on everything flagged (high + medium) so a thin top tier doesn't hide the signal
  const fn = tiers[0].n + tiers[1].n, fh = tiers[0].hits + tiers[1].hits
  const flagged = { n: fn, hits: fh, rate: fn ? fh / fn : 0 }
  return { month: m.months[at], horizon, baseline, tiers, flagged, lift: fn && baseline ? flagged.rate / baseline : null }
}
