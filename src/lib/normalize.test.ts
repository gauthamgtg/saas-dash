import { describe, it, expect } from 'vitest'
import { normalize } from './normalize'
import type { Mapping } from './mapping'

const mapping: Mapping = {
  paymentId: 'pid', invoiceNumber: 'inv', date: 'Date', customerId: 'cid', name: 'Name',
  country: 'Country', region: 'Region', businessModel: 'BM', currency: 'Ccy',
  amount: 'Amt', customerFlag: 'CF', refundFlag: 'RF',
}
const row = (o: Partial<Record<string, string>>) => ({
  pid: 'p', inv: 'i', Date: '2026-01-15', cid: 'c1', Name: 'A', Country: 'US',
  Region: 'NA', BM: 'sub', Ccy: 'USD', Amt: '100', CF: 'new', RF: 'false', ...o,
})

describe('normalize', () => {
  it('builds a transaction with month bucket and base amount', () => {
    const { transactions, issues } = normalize([row({})], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues).toHaveLength(0)
    expect(transactions[0].month).toBe('2026-01')
    expect(transactions[0].amountBase).toBe(100)
    expect(transactions[0].isRefund).toBe(false)
  })
  it('makes refund amounts negative when refunds are included', () => {
    const { transactions } = normalize(
      [row({ RF: 'true', Amt: '40' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(transactions[0].isRefund).toBe(true)
    expect(transactions[0].amountBase).toBe(-40)
  })
  it('drops refund rows when refunds are excluded', () => {
    const { transactions } = normalize(
      [row({ RF: 'true', Amt: '40' })], mapping, { USD: 1 }, { includeRefunds: false })
    expect(transactions).toHaveLength(0)
  })
  it('quarantines unparseable dates and non-numeric amounts', () => {
    const { transactions, issues } = normalize(
      [row({ Date: 'nope' }), row({ Amt: 'abc' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(transactions).toHaveLength(0)
    expect(issues).toHaveLength(2)
    expect(issues[0].reason).toMatch(/date/i)
  })
  it('quarantines rows in an unknown currency', () => {
    const { issues } = normalize([row({ Ccy: 'JPY' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues[0].reason).toMatch(/currency/i)
  })
})
