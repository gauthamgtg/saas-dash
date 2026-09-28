import { describe, it, expect } from 'vitest'
import { requiredGrowth, monthsToTarget, dailyCollections, dayKey } from './planning'
import type { Transaction } from './types'

describe('planning', () => {
  it('computes the compound rate to double in 12 months', () => {
    expect(requiredGrowth(100, 200, 12)).toBeCloseTo(Math.pow(2, 1 / 12) - 1)
    expect(requiredGrowth(0, 200, 12)).toBeNull()
    expect(requiredGrowth(100, 200, 0)).toBeNull()
  })
  it('counts months to target and handles never / already-there', () => {
    expect(monthsToTarget(100, 200, 0.1)).toBe(8) // 1.1^8 = 2.14
    expect(monthsToTarget(300, 200, 0.1)).toBe(0)
    expect(monthsToTarget(100, 200, 0)).toBeNull()
    expect(monthsToTarget(100, 200, -0.02)).toBeNull()
  })
  it('sums net collections per local day, refunds negative', () => {
    const tx = (d: Date, amt: number) => ({ date: d, amountBase: amt }) as Transaction
    const m = dailyCollections([tx(new Date(2025, 0, 5, 9), 100), tx(new Date(2025, 0, 5, 23), -20), tx(new Date(2025, 0, 6), 50)])
    expect(m.get('2025-01-05')).toBe(80)
    expect(m.get('2025-01-06')).toBe(50)
    expect(dayKey(new Date(2025, 11, 31, 23, 59))).toBe('2025-12-31')
  })
})
