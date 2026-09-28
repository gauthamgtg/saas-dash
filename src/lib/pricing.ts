import type { Transaction } from './types'
import { median } from './engine/stats'

/** customer → month → { amount (gross, refunds excluded), plan } */
export type Ledger = Map<string, Map<string, { amount: number; plan: string }>>

/** Plan when the export has one; business model as a fallback grouping. */
export const planDimension = (txs: Transaction[]) => (txs.some((t) => t.plan) ? 'plan' : 'businessModel') as 'plan' | 'businessModel'

export function planLedger(txs: Transaction[]): Ledger {
  const dim = planDimension(txs)
  const out: Ledger = new Map()
  const biggest = new Map<string, number>() // plan = plan on the month's largest payment
  for (const t of txs) {
    if (t.amountBase <= 0) continue
    const plan = (t[dim] as string | null | undefined) ?? 'Unknown'
    const row = out.get(t.customerId) ?? new Map()
    const cur = row.get(t.month)
    const k = `${t.customerId}|${t.month}`
    if (!cur) row.set(t.month, { amount: t.amountBase, plan })
    else { cur.amount += t.amountBase; if (t.amountBase > (biggest.get(k) ?? 0)) cur.plan = plan }
    biggest.set(k, Math.max(biggest.get(k) ?? 0, t.amountBase))
    out.set(t.customerId, row)
  }
  return out
}

/** Plans ordered cheapest → priciest by median account spend (drives upgrade vs downgrade). */
export function planRank(ledger: Ledger): Map<string, number> {
  const by = new Map<string, number[]>()
  for (const row of ledger.values()) for (const { amount, plan } of row.values()) by.set(plan, [...(by.get(plan) ?? []), amount])
  return new Map([...by].map(([p, v]) => [p, median(v) ?? 0] as const).sort((a, b) => a[1] - b[1]).map(([p], i) => [p, i]))
}

export type PriceEvent = {
  plan: string; month: string; change: number
  exposed: number; repriced: number; churned: number; downgraded: number
  churnRate: number; baselineChurn: number | null; controlChurn: number | null
  uplift: number; lost: number; net: number; horizon: number
  before: number | null; after: number | null // median charge of the repriced accounts, month before vs of
}

const H = 3 // months after a change used to measure its effect

/**
 * List-price change = in one month, a large share of accounts continuing on the same plan all see
 * their charge move by (nearly) the same %. Organic expansion is scattered; repricing clusters.
 */
export function detectPriceChanges(ledger: Ledger, months: string[], minShare = 0.4, minAccounts = 3): PriceEvent[] {
  const rank = planRank(ledger)
  const at = (c: string, mo: string | undefined) => (mo ? ledger.get(c)?.get(mo) : undefined)
  const customers = [...ledger.keys()]
  const events: PriceEvent[] = []

  // not paying `h` months later, among accounts on `plan` (or not on it) in `mo`
  const churnWindow = (i: number, onPlan: (p: string) => boolean) => {
    const start = months[i - 1], check = months[Math.min(months.length - 1, i + H - 1)]
    if (!start) return null
    const exposed = customers.filter((c) => { const a = at(c, start); return a && onPlan(a.plan) })
    return exposed.length ? exposed.filter((c) => !at(c, check)).length / exposed.length : null
  }

  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1], mo = months[i]
    const plans = new Set(customers.map((c) => at(c, prev)?.plan).filter((p): p is string => !!p))
    for (const plan of plans) {
      const cont = customers.filter((c) => at(c, prev)?.plan === plan && at(c, mo)?.plan === plan)
      const ratios = cont.map((c) => ({ c, r: at(c, mo)!.amount / at(c, prev)!.amount })).filter((x) => Math.abs(x.r - 1) >= 0.01)
      if (ratios.length < minAccounts) continue
      // densest ±1.5% cluster of ratios
      let best: typeof ratios = []
      for (const x of ratios) {
        const near = ratios.filter((y) => Math.abs(y.r - x.r) <= 0.015)
        if (near.length > best.length) best = near
      }
      if (best.length < minAccounts || best.length / cont.length < minShare) continue

      const exposedIds = customers.filter((c) => at(c, prev)?.plan === plan)
      const check = months[Math.min(months.length - 1, i + H - 1)]
      const churnedIds = exposedIds.filter((c) => !at(c, check))
      const downgraded = exposedIds.filter((c) => { const b = at(c, check); return b && (rank.get(b.plan) ?? 0) < (rank.get(plan) ?? 0) }).length
      const uplift = best.reduce((s, x) => s + at(x.c, mo)!.amount - at(x.c, prev)!.amount, 0)
      const lost = churnedIds.reduce((s, c) => s + at(c, prev)!.amount, 0)
      events.push({
        plan, month: mo, change: (median(best.map((x) => x.r)) ?? 1) - 1,
        exposed: exposedIds.length, repriced: best.length, churned: churnedIds.length, downgraded,
        churnRate: exposedIds.length ? churnedIds.length / exposedIds.length : 0,
        baselineChurn: i - H >= 1 ? churnWindow(i - H, (p) => p === plan) : null,
        controlChurn: churnWindow(i, (p) => p !== plan),
        uplift, lost, net: uplift - lost, horizon: Math.min(H, months.length - i),
        before: median(best.map((x) => at(x.c, prev)!.amount)),
        after: median(best.map((x) => at(x.c, mo)!.amount)),
      })
    }
  }
  return events.sort((a, b) => b.month.localeCompare(a.month))
}

export type FlowKind = 'stay' | 'upgrade' | 'downgrade' | 'new' | 'churn'
export type Flow = { from: string; to: string; kind: FlowKind; customers: number; mrrFrom: number; mrrTo: number }

/** Who moved between plans from one month to another (plus new and churned accounts). */
export function planFlows(ledger: Ledger, from: string, to: string, rank = planRank(ledger)): Flow[] {
  const agg = new Map<string, Flow>()
  for (const [, row] of ledger) {
    const a = row.get(from), b = row.get(to)
    if (!a && !b) continue
    if (!a && [...row.keys()].some((mo) => mo <= from)) continue // dormant at `from`; reactivations not counted as plan moves
    const f = a ? a.plan : 'New', t = b ? b.plan : 'Churned'
    const kind: FlowKind = !a ? 'new' : !b ? 'churn' : f === t ? 'stay' : (rank.get(t) ?? 0) > (rank.get(f) ?? 0) ? 'upgrade' : 'downgrade'
    const k = `${f}→${t}`
    const cur = agg.get(k) ?? { from: f, to: t, kind, customers: 0, mrrFrom: 0, mrrTo: 0 }
    cur.customers++; cur.mrrFrom += a?.amount ?? 0; cur.mrrTo += b?.amount ?? 0
    agg.set(k, cur)
  }
  return [...agg.values()].sort((x, y) => y.customers - x.customers)
}

/** Upgrades / downgrades per quarter (quarter-end to quarter-end), with the MRR they moved. */
export function quarterlyMoves(ledger: Ledger, months: string[]) {
  const ends = months.filter((m, i) => Number(m.slice(5)) % 3 === 0 || i === months.length - 1)
  const rank = planRank(ledger)
  return ends.slice(1).map((to, i) => {
    const flows = planFlows(ledger, ends[i], to, rank)
    const sum = (k: FlowKind) => flows.filter((f) => f.kind === k)
    const up = sum('upgrade'), down = sum('downgrade')
    return {
      quarter: `${to.slice(0, 4)} Q${Math.ceil(Number(to.slice(5)) / 3)}`, from: ends[i], to,
      upgrades: up.reduce((s, f) => s + f.customers, 0), downgrades: down.reduce((s, f) => s + f.customers, 0),
      upMrr: up.reduce((s, f) => s + f.mrrTo - f.mrrFrom, 0), downMrr: down.reduce((s, f) => s + f.mrrTo - f.mrrFrom, 0),
    }
  })
}
