import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { arpa, arr, grr, nrr, momGrowth, yoyGrowth, avgLifetimeMonths, ltvRevenue } from './kpis'
import { scenario, tx } from '../testdata'

describe('kpis', () => {
  const m = buildMatrix(scenario(), 'activity')
  it('ARR is 12x MRR', () => {
    expect(arr(m, '2026-01')).toBe(3600) // 300 * 12
  })
  it('ARPA = MRR / active customers', () => {
    expect(arpa(m, '2026-01')).toBe(150) // 300 / 2
  })
  it('MoM growth Jan->Feb', () => {
    // Feb MRR = 150 (c1) + 0 (c2) + 300 (c3) = 450; Jan = 300 => +50%
    expect(momGrowth(m, '2026-02')).toBeCloseTo(0.5)
  })
  it('NRR credits expansion, GRR clamps it (Jan cohort, Jan->Feb)', () => {
    // Jan cohort {c1:100, c2:200}=300; Feb {c1:150, c2:0}=150
    expect(nrr(m, '2026-01', '2026-02')).toBeCloseTo(150 / 300)
    expect(grr(m, '2026-01', '2026-02')).toBeCloseTo((100 + 0) / 300) // min(150,100)=100, min(0,200)=0
  })
  it('YoY needs >=13 months of history => null here', () => {
    expect(yoyGrowth(m, '2026-03')).toBeNull()
  })
  it('avg lifetime and revenue LTV guard divide-by-zero', () => {
    expect(avgLifetimeMonths(0)).toBeNull()
    expect(avgLifetimeMonths(0.25)).toBe(4)
    expect(ltvRevenue(150, 0.8, 0.25)).toBeCloseTo(150 * 0.8 / 0.25)
  })
})
