import { describe, it, expect } from 'vitest'
import { MRR_MODES, monthKey, addMonths, monthRange } from './types'

describe('month helpers', () => {
  it('formats a month key as YYYY-MM', () => {
    expect(monthKey(new Date('2026-03-15T00:00:00Z'))).toBe('2026-03')
  })
  it('adds months across a year boundary', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-02', -3)).toBe('2025-11')
  })
  it('builds an inclusive contiguous range', () => {
    expect(monthRange('2026-01', '2026-04')).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
  })
  it('exposes the two MRR modes', () => {
    expect(MRR_MODES).toEqual(['activity', 'subscription'])
  })
})
