import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { activeSeries, newLogosSeries, netLogoSeries, seasonalityIndex } from './trends'
import { firstPurchaseToRepeat, timeToSecondPurchaseDays, initialDealSizes, realizedLtvByCohort } from './lifecycle'
import { cadenceDays, revenueVolatility, refundLatencies, refundFreeShare, rfm, healthScore } from './cx'
import { revenueDeciles, whaleVsLongTail, billingFrequencyMix } from './concentration'
import { t2d3, revenueWeightedChurn } from './investor'
import { scenario, tx } from '../testdata'

const m = buildMatrix(scenario(), 'activity')
const txs = scenario()

describe('trends', () => {
  it('active customers per month', () => {
    expect(activeSeries(m).map((s) => s.active)).toEqual([2, 2, 3])
  })
  it('new logos per month by first-active', () => {
    expect(newLogosSeries(m).map((s) => s.newLogos)).toEqual([2, 1, 0])
  })
  it('net logo adds − losses', () => {
    expect(netLogoSeries(m).map((s) => s.net)).toEqual([2, 0, 0])
  })
  it('seasonality null under 12 months', () => {
    expect(seasonalityIndex(m)).toBeNull()
  })
})

describe('lifecycle', () => {
  it('first→repeat conversion (all 3 repeat)', () => {
    expect(firstPurchaseToRepeat(txs)).toBeCloseTo(1)
  })
  it('conversion denominator counts refund-only customers too', () => {
    const data = [
      tx({ customerId: 'r1', month: '2026-01', amountBase: 100 }),
      tx({ customerId: 'r1', month: '2026-02', amountBase: 100 }), // repeater
      tx({ customerId: 'r2', month: '2026-01', amountBase: -50, isRefund: true }), // refund-only
    ]
    expect(firstPurchaseToRepeat(data)).toBeCloseTo(0.5) // 1 repeater / 2 distinct customers
  })
  it('median time to second purchase', () => {
    expect(timeToSecondPurchaseDays(txs)).toBe(31) // gaps [31,59,28] → median 31
  })
  it('initial deal sizes', () => {
    expect(initialDealSizes(txs).sort((a, b) => a - b)).toEqual([100, 200, 300])
  })
  it('realized LTV curve for the Jan cohort', () => {
    const jan = realizedLtvByCohort(m).find((c) => c.cohortMonth === '2026-01')!
    expect(jan.cumAvg).toEqual([150, 225, 400])
  })
})

describe('cx', () => {
  it('cadence = median inter-payment gap', () => {
    expect(cadenceDays(txs, 'c1')).toBeCloseTo(29.5) // [31,28]
  })
  it('revenue volatility CV over active span', () => {
    expect(revenueVolatility(m, 'c1')).toBeCloseTo(0.216, 2)
  })
  it('refund latency links refund to original by invoice', () => {
    const data = [
      tx({ customerId: 'x', month: '2026-01', amountBase: 100, invoiceNumber: 'inv', date: new Date(Date.UTC(2026, 0, 1)) }),
      tx({ customerId: 'x', month: '2026-01', amountBase: -100, invoiceNumber: 'inv', isRefund: true, date: new Date(Date.UTC(2026, 0, 11)) }),
    ]
    expect(refundLatencies(data)).toEqual([10])
  })
  it('refund-free share (no refunds in fixture)', () => {
    expect(refundFreeShare(txs)).toBe(1)
  })
  it('rfm returns valid 1-5 scores per customer', () => {
    const r = rfm(txs, new Date(Date.UTC(2026, 2, 15)))
    expect(r).toHaveLength(3)
    for (const x of r) { expect(x.r).toBeGreaterThanOrEqual(1); expect(x.m).toBeLessThanOrEqual(5) }
  })
  it('health score is bounded 0-100', () => {
    const h = healthScore(m, txs, 'c1', new Date(Date.UTC(2026, 2, 15)), 90)
    expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThanOrEqual(100)
  })
})

describe('concentration', () => {
  it('deciles cover all revenue', () => {
    const d = revenueDeciles(txs)
    expect(d).toHaveLength(10)
    expect(d.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1)
  })
  it('whale vs long tail (top 20%)', () => {
    const w = whaleVsLongTail(txs, 0.2)
    expect(w.whaleCount).toBe(1)
    expect(w.whaleShare).toBeCloseTo(550 / 1350)
  })
  it('billing frequency mix by inferred cadence', () => {
    const b = billingFrequencyMix(txs)
    expect(b.monthly).toBeCloseTo(2 / 3) // c1, c3 monthly; c2 quarterly
    expect(b.quarterly).toBeCloseTo(1 / 3)
  })
})

describe('investor', () => {
  it('t2d3 empty under 13 months', () => {
    expect(t2d3(m)).toEqual([])
  })
  it('revenue-weighted churn Jan→Feb', () => {
    // Jan cohort {c1:100, c2:200}=300; c2 drops to 0 in Feb → 200 lost
    expect(revenueWeightedChurn(m, '2026-01', '2026-02')).toBeCloseTo(200 / 300)
  })
})
