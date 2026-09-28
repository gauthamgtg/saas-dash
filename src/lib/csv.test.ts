import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { encodeShare, decodeShare } from './share'

describe('toCsv', () => {
  it('escapes quotes/commas/newlines and unions columns', () => {
    const csv = toCsv([
      { a: 'plain', b: 'has,comma' },
      { a: 'has "quote"', c: 'line\nbreak' },
    ])
    expect(csv.split('\n')[0]).toBe('a,b,c')
    expect(csv).toContain('"has,comma"')
    expect(csv).toContain('"has ""quote"""')
    expect(csv).toContain('"line\nbreak"')
  })
  it('empty rows → empty string', () => expect(toCsv([])).toBe(''))
})

describe('share codec', () => {
  it('roundtrips a payload through gzip+base64url', async () => {
    const payload = { v: 1, transactions: [{ customerId: 'c1', amountBase: 99.5, date: '2026-01-05T00:00:00.000Z' }], view: 'overview' }
    const enc = await encodeShare(payload)
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/) // url-safe, no padding
    expect(await decodeShare(enc)).toEqual(payload)
  })
  it('garbage input → null, not throw', async () => {
    expect(await decodeShare('not-valid!!')).toBeNull()
  })
})
