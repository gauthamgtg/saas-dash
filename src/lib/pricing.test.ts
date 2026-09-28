import { describe, it, expect } from 'vitest'
import { tx } from './testdata'
import { planLedger, detectPriceChanges, planFlows, planRank, quarterlyMoves } from './pricing'
import type { Transaction } from './types'

const MONTHS = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']
const acct = (id: string, plan: string | ((i: number) => string), amt: (i: number) => number, until = 6): Transaction[] =>
  MONTHS.slice(0, until).map((month, i) => ({ ...tx({ customerId: id, month, amountBase: amt(i) }), plan: typeof plan === 'string' ? plan : plan(i) }))

// Five Pro accounts with different seat counts; list price +10% from March. One churns in May.
const txs = [
  ...[100, 150, 200, 250].flatMap((b, k) => acct(`p${k}`, 'Pro', (i) => (i >= 2 ? Math.round(b * 1.1) : b))),
  ...acct('p4', 'Pro', (i) => (i >= 2 ? 330 : 300), 4),
  // Basic accounts: organic noise, one upgrades to Pro in June
  ...acct('b0', 'Basic', () => 50), ...acct('b1', 'Basic', (i) => 50 + i * 7),
  ...acct('b2', (i) => (i >= 5 ? 'Pro' : 'Basic'), (i) => (i >= 5 ? 120 : 50)),
]
const ledger = planLedger(txs)

describe('pricing', () => {
  it('detects a clustered list-price change and its impact', () => {
    const ev = detectPriceChanges(ledger, MONTHS)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ plan: 'Pro', month: '2025-03', exposed: 5, repriced: 5, churned: 1 })
    expect(ev[0].change).toBeCloseTo(0.1, 2)
    expect(ev[0].uplift).toBe(10 + 15 + 20 + 25 + 30)
    expect(ev[0].lost).toBe(300)
  })
  it('ranks plans by spend and classifies migrations', () => {
    expect(planRank(ledger).get('Pro')).toBeGreaterThan(planRank(ledger).get('Basic')!)
    const flows = planFlows(ledger, '2025-03', '2025-06')
    expect(flows.find((f) => f.from === 'Basic' && f.to === 'Pro')).toMatchObject({ kind: 'upgrade', customers: 1 })
    expect(flows.find((f) => f.to === 'Churned')).toMatchObject({ from: 'Pro', customers: 1 })
  })
  it('rolls moves up by quarter', () => {
    const q = quarterlyMoves(ledger, MONTHS)
    expect(q.map((x) => x.quarter)).toEqual(['2025 Q2'])
    expect(q[0]).toMatchObject({ upgrades: 1, downgrades: 0, upMrr: 70 })
  })
})
