import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { cohorts } from './cohorts'
import { tx } from '../testdata'

describe('cohorts', () => {
  // Two Jan-cohort customers: a=100->120 (expansion), b=100->0 (churn month 1)
  const m = buildMatrix([
    tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'a', month: '2026-02', amountBase: 120 }),
    tx({ customerId: 'b', month: '2026-01', amountBase: 100 }),
  ], 'activity')
  const c = cohorts(m)
  const jan = c.find((x) => x.cohortMonth === '2026-01')!

  it('sizes the cohort by first-active month', () => {
    expect(jan.size).toBe(2)
  })
  it('net dollar retention credits expansion (age 1 = 120/200)', () => {
    expect(jan.netRetention[1]).toBeCloseTo(0.6)
  })
  it('gross dollar retention clamps expansion (age 1 = min(120,100)+0 / 200)', () => {
    expect(jan.grossRetention[1]).toBeCloseTo(0.5)
  })
  it('logo survival at age 1 = 1 of 2 still active', () => {
    expect(jan.logoSurvival[1]).toBeCloseTo(0.5)
  })
})
