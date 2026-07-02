import { describe, it, expect } from 'vitest'
import { detectCurrencies, convert } from './fx'

describe('fx', () => {
  it('lists distinct non-empty currencies', () => {
    expect(detectCurrencies(['USD', 'EUR', 'USD', '', 'INR']).sort()).toEqual(['EUR', 'INR', 'USD'])
  })
  it('converts using the rate table', () => {
    const rates = { USD: 1, EUR: 1.1 }
    expect(convert(100, 'EUR', rates)).toBeCloseTo(110)
    expect(convert(100, 'USD', rates)).toBe(100)
  })
  it('returns null for an unknown currency', () => {
    expect(convert(100, 'JPY', { USD: 1 })).toBeNull()
  })
  it('treats a null/empty currency as base (rate 1)', () => {
    expect(convert(100, null, { USD: 1 })).toBe(100)
  })
})
