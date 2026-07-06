import { describe, it, expect } from 'vitest'
import { normalize, normalizeRow } from './normalize'
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
  it('quarantines rows with a missing customer id', () => {
    const { issues } = normalize([row({ cid: '' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues[0].reason).toMatch(/customer/i)
  })
  it('normalizeRow agrees with normalize for the same row', () => {
    const { issues } = normalize([row({ Date: 'nope' })], mapping, { USD: 1 }, { includeRefunds: true })
    const direct = normalizeRow(row({ Date: 'nope' }), 0, mapping, { USD: 1 }, { includeRefunds: true, dateOrder: 'mdy' })
    expect('issue' in direct && direct.issue.reason).toBe(issues[0].reason)
  })
  it('applies row overrides on top of the parsed data', () => {
    const rows = [row({ Date: 'nope' }), row({})]
    const { transactions, issues, total } = normalize(rows, mapping, { USD: 1 }, { includeRefunds: true }, {
      overrides: { 0: { Date: '2026-02-01' } },
    })
    expect(issues).toHaveLength(0)
    expect(transactions).toHaveLength(2)
    expect(total).toBe(2)
  })
  it('excludes removed rows from both transactions and issues, but keeps the original total', () => {
    const rows = [row({ Date: 'nope' }), row({})]
    const { transactions, issues, total } = normalize(rows, mapping, { USD: 1 }, { includeRefunds: true }, {
      removed: new Set([0]),
    })
    expect(issues).toHaveLength(0)
    expect(transactions).toHaveLength(1)
    expect(total).toBe(2)
  })
})
