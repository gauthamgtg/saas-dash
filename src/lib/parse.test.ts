import { describe, it, expect } from 'vitest'
import { parseCsv } from './parse'

describe('parseCsv', () => {
  it('returns headers and row objects', () => {
    const csv = 'Date,customer_id,Overall Revenue\n2026-01-01,c1,100\n2026-01-02,c2,200\n'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Date', 'customer_id', 'Overall Revenue'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ Date: '2026-01-01', customer_id: 'c1', 'Overall Revenue': '100' })
  })
  it('trims header whitespace and skips fully-empty rows', () => {
    const csv = ' Date , customer_id \n2026-01-01,c1\n\n'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Date', 'customer_id'])
    expect(rows).toHaveLength(1)
  })
})
