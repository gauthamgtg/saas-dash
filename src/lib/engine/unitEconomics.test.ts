import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { newCustomersByMonth, spendByMonth, cacSeries, blendedCac, cacPaybackMonths } from './unitEconomics'
import { parseSpendRows } from '../spend'
import { parseCsv } from '../parse'
import { tx } from '../testdata'

const txs = [
  tx({ customerId: 'a', month: '2025-01', amountBase: 100 }),
  tx({ customerId: 'a', month: '2025-02', amountBase: 100 }),
  tx({ customerId: 'b', month: '2025-02', amountBase: 200 }),
  tx({ customerId: 'c', month: '2025-02', amountBase: 50 }),
]
const m = buildMatrix(txs, 'activity')

const spend = [
  { month: '2025-01', channel: 'Ads', category: 'marketing' as const, amount: 500 },
  { month: '2025-02', channel: 'Ads', category: 'marketing' as const, amount: 600 },
  { month: '2025-02', channel: 'Sales team', category: 'sales' as const, amount: 400 },
  { month: '2025-02', channel: 'Rent', category: 'other' as const, amount: 9999 }, // excluded from CAC
]

describe('unitEconomics', () => {
  it('counts new customers by first active month', () => {
    const n = newCustomersByMonth(m)
    expect(n.get('2025-01')).toBe(1)
    expect(n.get('2025-02')).toBe(2)
  })

  it('CAC = S&M spend / new customers, ignoring "other"', () => {
    const s = cacSeries(m, spend)
    expect(s).toEqual([
      { month: '2025-01', smSpend: 500, newCustomers: 1, cac: 500 },
      { month: '2025-02', smSpend: 1000, newCustomers: 2, cac: 500 },
    ])
    expect(blendedCac(s)).toBe(1500 / 3)
    expect(spendByMonth(spend).get('2025-02')).toBe(600 + 400 + 9999)
  })

  it('payback = CAC / (ARPA * margin)', () => {
    expect(cacPaybackMonths(500, 125, 0.8)).toBe(5)
  })

  it('parses the spend CSV format with aliases and defaults', () => {
    const { rows, errors } = parseSpendRows(parseCsv('Date,Source,Spend\n2025-03-15,"Google Ads","$1,200"\nbad,x,5\n2025-04,,300'))
    expect(errors).toHaveLength(1)
    expect(rows).toEqual([
      { month: '2025-03', channel: 'Google Ads', category: 'marketing', amount: 1200 },
      { month: '2025-04', channel: 'Unattributed', category: 'marketing', amount: 300 },
    ])
  })

  it('rejects files missing required columns', () => {
    const { rows, errors } = parseSpendRows(parseCsv('foo,bar\n1,2'))
    expect(rows).toHaveLength(0)
    expect(errors[0]).toMatch(/month, amount/)
  })
})
