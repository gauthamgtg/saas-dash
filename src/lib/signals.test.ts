import { describe, it, expect } from 'vitest'
import { buildMatrix } from './engine/matrix'
import { tx } from './testdata'
import { scoreAccounts, groupByCustomer, backtest } from './signals'
import type { Transaction } from './types'

const MONTHS = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`)
const series = (id: string, amounts: number[]): Transaction[] =>
  amounts.flatMap((a, i) => (a ? [tx({ customerId: id, month: MONTHS[i], amountBase: a })] : []))

// shrinker: steady, then six straight downgrades
// grower: steady then climbing; steady: flat control
const txs = [
  ...series('shrinker', [500, 500, 500, 500, 500, 480, 400, 330, 260, 200, 150, 120]),
  ...series('grower', [100, 100, 100, 100, 100, 110, 130, 160, 190, 230, 270, 320]),
  ...series('steady', [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]),
]
const m = buildMatrix(txs, 'activity')
const by = groupByCustomer(txs)
const scores = scoreAccounts(m, by, 11, new Date(Date.UTC(2025, 11, 20)))
const of = (id: string) => scores.find((s) => s.customerId === id)!

describe('signals', () => {
  it('flags a steadily shrinking account as high churn risk with reasons', () => {
    expect(of('shrinker').churnTier).toBe('high')
    expect(of('shrinker').churnSignals.map((s) => s.key)).toEqual(expect.arrayContaining(['momentum', 'streak', 'peak']))
    expect(of('shrinker').churn).toBeGreaterThan(of('steady').churn)
  })
  it('flags a growing account for expansion and not the shrinker', () => {
    expect(of('grower').expansion).toBeGreaterThan(of('steady').expansion)
    expect(of('grower').expansionTier).not.toBe('low')
    expect(of('shrinker').expansionTier).toBe('low')
  })
  it('keeps a flat, on-time account low risk', () => {
    expect(of('steady').churnTier).toBe('low')
    expect(of('steady').churnSignals).toHaveLength(0)
  })
  it('points always sum to the score (explainability)', () => {
    for (const s of scores) expect(s.churn).toBe(Math.min(100, s.churnSignals.reduce((a, x) => a + x.points, 0)))
  })
  it('backtests on history and returns tier hit rates', () => {
    const bt = backtest(m, by, 'expansion', 3)!
    expect(bt.month).toBe('2025-09')
    expect(bt.tiers.reduce((s, t) => s + t.n, 0)).toBe(3)
    expect(backtest(buildMatrix(txs.filter((t) => t.month < '2025-07'), 'activity'), by, 'churn', 3)).toBeNull()
  })
})
