import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { movementSeries } from './movement'
import { quickRatio, cmgr, newVsRepeatRevenue } from './kpis'
import { gini, paretoConcentration, dominantCurrencyShare, dimensionHhi } from './segments'
import { scenario } from '../testdata'

describe('extra kpis', () => {
  const m = buildMatrix(scenario(), 'activity')
  it('quick ratio = inflows/outflows over the series', () => {
    // inflow: new300+exp50 (Feb) + react200 (Mar) = 550; outflow: churn200 (Feb) + contr50 (Mar) = 250
    expect(quickRatio(movementSeries(m, { reactivationGapK: 1 }))).toBeCloseTo(550 / 250)
  })
  it('CMGR compounds first→last MRR', () => {
    // 300 → 600 over 2 months
    expect(cmgr(m)).toBeCloseTo(Math.sqrt(2) - 1)
  })
  it('new vs repeat splits first-active revenue from the rest', () => {
    const r = newVsRepeatRevenue(m)
    expect(r.newRevenue).toBe(600) // c1 100 + c2 200 + c3 300 (first active months)
    expect(r.repeatRevenue).toBe(750) // 1350 - 600
  })
})

describe('extra concentration', () => {
  const txs = scenario()
  it('gini is between 0 and 1', () => {
    expect(gini(txs)).toBeCloseTo(0.0741, 3)
  })
  it('pareto: top-20% share + customers-to-80%', () => {
    const p = paretoConcentration(txs)
    expect(p.top20Share).toBeCloseTo(550 / 1350) // largest customer
    expect(p.customersToEightyPct).toBe(1) // all 3 needed to reach 80% here
  })
  it('dominant currency share (all USD in fixture)', () => {
    expect(dominantCurrencyShare(txs)).toBeCloseTo(1)
  })
  it('region HHI flags concentration', () => {
    expect(dimensionHhi(txs, 'region')).toBeGreaterThan(2500)
  })
})
