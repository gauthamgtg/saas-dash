import { describe, it, expect } from 'vitest'
import { tx } from './testdata'
import { marketStats, baseCurrency, currencyExposure, tileLayout, geoOf } from './geo'

const txs = [
  // US: one account growing 100 → 200 over Jan..Jul
  ...[100, 110, 120, 140, 160, 180, 200].map((a, i) => tx({ customerId: 'us1', month: `2025-0${i + 1}`, amountBase: a, country: 'United States', currency: 'USD' })),
  // DE: one account flat at 100 EUR→USD, new account joins in Jun
  ...[1, 2, 3, 4, 5, 6, 7].map((i) => tx({ customerId: 'de1', month: `2025-0${i}`, amountBase: 110, amountNative: 100, country: 'Germany', currency: 'EUR' })),
  tx({ customerId: 'de2', month: '2025-06', amountBase: 55, amountNative: 50, country: 'Germany', currency: 'EUR' }),
  tx({ customerId: 'de2', month: '2025-07', amountBase: 55, amountNative: 50, country: 'Germany', currency: 'EUR' }),
]

describe('geo', () => {
  const { rows } = marketStats(txs, 'country', 'activity')
  const us = rows.find((r) => r.key === 'United States')!, de = rows.find((r) => r.key === 'Germany')!
  it('computes per-market MRR, share and growth on a shared axis', () => {
    expect(us.mrr).toBe(200)
    expect(de.mrr).toBe(165)
    expect(us.share + de.share).toBeCloseTo(1)
    expect(us.growth).toBeCloseTo(Math.pow(200 / 100, 1 / 6) - 1) // Jan → Jul, 6 steps
    expect(de.newLogos).toBe(1)
    expect(de.firstMonth).toBe('2025-01')
  })
  it('detects base currency and FX-exposed share', () => {
    expect(baseCurrency(txs)).toBe('USD')
    const fx = currencyExposure(txs, '2025-07')
    expect(fx.foreign).toBe(165)
    expect(fx.foreignShare).toBeCloseTo(165 / 365)
  })
  it('lays out a tile map with no two countries on one cell', () => {
    const t = tileLayout()
    expect(new Set(t.map((x) => `${x.col},${x.row}`)).size).toBe(t.length)
    expect(t.length).toBeGreaterThan(40)
    expect(geoOf('USA')?.name).toBe('united states')
  })
})
