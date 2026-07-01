import { describe, it, expect } from 'vitest'
import { buildMatrix, mrrOf, activeCustomers, get } from './matrix'
import { scenario, tx } from '../testdata'

describe('buildMatrix (activity mode)', () => {
  const m = buildMatrix(scenario(), 'activity')
  it('has a contiguous month axis', () => {
    expect(m.months).toEqual(['2026-01', '2026-02', '2026-03'])
  })
  it('sums payments per customer-month', () => {
    expect(get(m, 'c1', '2026-02')).toBe(150)
    expect(get(m, 'c2', '2026-02')).toBe(0) // gap filled with 0
  })
  it('computes MRR as the column sum', () => {
    expect(mrrOf(m, '2026-01')).toBe(300) // 100 + 200
    expect(mrrOf(m, '2026-03')).toBe(600) // 150 + 200 + 250
  })
  it('counts active (nonzero) customers per month', () => {
    expect(activeCustomers(m, '2026-02')).toBe(2) // c1, c3
  })
})

describe('buildMatrix (subscription mode)', () => {
  it('amortizes an annual payment across 12 months', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 1200, date: new Date(Date.UTC(2026, 0, 1)) }),
      tx({ customerId: 'a', month: '2027-01', amountBase: 1200, date: new Date(Date.UTC(2027, 0, 1)) }),
    ]
    const m = buildMatrix(txs, 'subscription')
    expect(get(m, 'a', '2026-01')).toBeCloseTo(100)
    expect(get(m, 'a', '2026-06')).toBeCloseTo(100)
    expect(get(m, 'a', '2026-12')).toBeCloseTo(100)
  })
})
