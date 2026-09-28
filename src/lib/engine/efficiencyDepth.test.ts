import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { paidVsOrganicCac, cacByChannel } from './efficiencyDepth'
import { tx } from '../testdata'

// a, b arrive via Ads; c, d via SEO; one month of spend: Ads 800, SEO 200
const m = buildMatrix(['a', 'b', 'c', 'd'].map((c) => tx({ customerId: c, month: '2025-01', amountBase: 100 })), 'activity')
const spend = [
  { month: '2025-01', channel: 'Ads', category: 'marketing' as const, amount: 800 },
  { month: '2025-01', channel: 'SEO', category: 'marketing' as const, amount: 200 },
]
const sources = new Map([['a', 'Ads'], ['b', 'ads'], ['c', 'SEO'], ['d', 'Direct']])

describe('paidVsOrganicCac', () => {
  it('attributes logos by acquisition source', () => {
    const r = paidVsOrganicCac(m, spend, sources)
    expect(r.attributed).toBe(true)
    expect(r.paidCac).toBe(400) // 800 / 2 paid logos
    expect(r.organicCac).toBe(100) // 200 / (SEO + Direct)
  })
  it('falls back to spend-share allocation, which equalises the two', () => {
    const r = paidVsOrganicCac(m, spend)
    expect(r.attributed).toBe(false)
    expect(r.paidCac).toBeCloseTo(r.organicCac!)
  })
})

describe('cacByChannel', () => {
  it('credits logos to the spend channel of the same name', () => {
    const by = Object.fromEntries(cacByChannel(m, spend, sources).map((c) => [c.channel, c.cac]))
    expect(by).toEqual({ Ads: 400, SEO: 200 }) // Direct has no spend channel
  })
})
