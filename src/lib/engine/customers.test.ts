import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { atRisk, perCustomerRefundRate, recencyDays } from './customers'
import { tx } from '../testdata'

describe('customer signals', () => {
  it('flags a customer whose MRR declined N consecutive months', () => {
    const m = buildMatrix([
      tx({ customerId: 'd', month: '2026-01', amountBase: 300 }),
      tx({ customerId: 'd', month: '2026-02', amountBase: 200 }),
      tx({ customerId: 'd', month: '2026-03', amountBase: 100 }),
    ], 'activity')
    expect(atRisk(m, 'd', 2)).toBe(true)
    expect(atRisk(m, 'd', 3)).toBe(false) // only 2 declines observable
  })
  it('computes per-customer refund rate from signed rows', () => {
    const txs = [
      tx({ customerId: 'e', month: '2026-01', amountBase: 100, isRefund: false }),
      tx({ customerId: 'e', month: '2026-02', amountBase: -30, isRefund: true }),
    ]
    expect(perCustomerRefundRate(txs, 'e')).toBeCloseTo(30 / 100)
  })
  it('computes recency in days from a fixed as-of date', () => {
    const txs = [tx({ customerId: 'f', month: '2026-01', amountBase: 100, date: new Date(Date.UTC(2026, 0, 1)) })]
    expect(recencyDays(txs, 'f', new Date(Date.UTC(2026, 0, 31)))).toBe(30)
  })
})
