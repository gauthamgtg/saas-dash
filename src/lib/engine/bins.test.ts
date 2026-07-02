import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { binAnalysis } from './bins'
import { DEFAULT_BINS } from '../types'
import { tx } from '../testdata'

describe('binAnalysis', () => {
  // Jan: three customers at 100, 600, 3000
  const m = buildMatrix([
    tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'b', month: '2026-01', amountBase: 600 }),
    tx({ customerId: 'c', month: '2026-01', amountBase: 3000 }),
  ], 'activity')
  const res = binAnalysis(m, '2026-01', DEFAULT_BINS)

  it('assigns each customer to the right (min,max] bin', () => {
    expect(res.bins.find((b) => b.label === 'Less than $250')!.customers).toBe(1)
    expect(res.bins.find((b) => b.label === '$501 - $1000')!.customers).toBe(1)
    expect(res.bins.find((b) => b.label === 'More than $2500')!.customers).toBe(1)
  })
  it('computes contribution share against the month total (3700)', () => {
    const top = res.bins.find((b) => b.label === 'More than $2500')!
    expect(top.revenue).toBe(3000)
    expect(top.share).toBeCloseTo(3000 / 3700)
  })
  it('computes avg MRR and avg ACV per bin', () => {
    const top = res.bins.find((b) => b.label === 'More than $2500')!
    expect(top.avgMrr).toBe(3000)
    expect(top.avgAcv).toBe(36000)
  })
})
