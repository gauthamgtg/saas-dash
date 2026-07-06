import { describe, it, expect } from 'vitest'
import { parseDate, detectDateOrder } from './date'

const ymd = (d: Date | null) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : null)

describe('parseDate', () => {
  it('parses day-first DD/MM/YYYY (the reported bug)', () => {
    expect(ymd(parseDate('13/4/2024', 'dmy'))).toBe('2024-04-13')
    expect(ymd(parseDate('13/4/2024', 'auto'))).toBe('2024-04-13') // 13 > 12 ⇒ unambiguously day-first
  })
  it('parses month-first MM/DD/YYYY', () => {
    expect(ymd(parseDate('4/13/2024', 'mdy'))).toBe('2024-04-13')
  })
  it('disambiguates the same string by order', () => {
    expect(ymd(parseDate('3/4/2024', 'dmy'))).toBe('2024-04-03')
    expect(ymd(parseDate('3/4/2024', 'mdy'))).toBe('2024-03-04')
  })
  it('parses ISO and year-first', () => {
    expect(ymd(parseDate('2024-04-13'))).toBe('2024-04-13')
    expect(ymd(parseDate('2024-04-13T10:30:00Z'))).toBe('2024-04-13')
    expect(ymd(parseDate('2024/04/13'))).toBe('2024-04-13')
  })
  it('parses month-name formats', () => {
    expect(ymd(parseDate('13 Apr 2024'))).toBe('2024-04-13')
    expect(ymd(parseDate('Apr 13, 2024'))).toBe('2024-04-13')
    expect(ymd(parseDate('April 13 2024'))).toBe('2024-04-13')
  })
  it('parses Excel serial numbers', () => {
    expect(parseDate('45000')?.getUTCFullYear()).toBe(2023)
  })
  it('rejects impossible dates and junk', () => {
    expect(parseDate('13/13/2024', 'auto')).toBeNull() // no valid month
    expect(parseDate('31/2/2024', 'dmy')).toBeNull() // Feb 31 rolls over ⇒ rejected
    expect(parseDate('garbage')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
})

describe('detectDateOrder', () => {
  it('detects day-first from >12 first components', () => {
    expect(detectDateOrder(['13/4/2024', '15/4/2024', '1/2/2024'])).toBe('dmy')
  })
  it('detects month-first', () => {
    expect(detectDateOrder(['4/13/2024', '4/15/2024'])).toBe('mdy')
  })
  it('detects year-first', () => {
    expect(detectDateOrder(['2024-04-13', '2024-05-01'])).toBe('ymd')
  })
  it('defaults to month-first when fully ambiguous', () => {
    expect(detectDateOrder(['1/2/2024', '3/4/2024'])).toBe('mdy')
  })
})
