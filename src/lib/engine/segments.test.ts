import { describe, it, expect } from 'vitest'
import { revenueByDimension, topCustomers, hhi, topNShare } from './segments'
import { scenario } from '../testdata'

describe('segments', () => {
  const txs = scenario()
  it('groups revenue by a dimension and computes share', () => {
    const byRegion = revenueByDimension(txs, 'region')
    const na = byRegion.find((r) => r.key === 'NA')!
    const eu = byRegion.find((r) => r.key === 'EU')!
    expect(na.revenue).toBe(100 + 150 + 150 + 200 + 200) // c1 + c2 = 800
    expect(eu.revenue).toBe(300 + 250) // c3 = 550
    expect(na.share).toBeCloseTo(800 / 1350)
  })
  it('ranks top customers by total revenue', () => {
    // totals: c1=400, c2=400, c3=550
    const top = topCustomers(txs, 2)
    expect(top[0].customerId).toBe('c3') // 550, the largest
    expect(top[0].revenue).toBe(550)
    expect(top[1].revenue).toBe(400)
  })
  it('top-1 share and HHI reflect concentration', () => {
    // totals: c1=400, c2=400, c3=550 => total 1350
    expect(topNShare(txs, 1)).toBeCloseTo(550 / 1350)
    const shares = [400, 400, 550].map((v) => (100 * v) / 1350)
    const expected = shares.reduce((s, p) => s + p * p, 0)
    expect(hhi(txs)).toBeCloseTo(expected)
  })
})
