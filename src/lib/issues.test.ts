import { describe, it, expect } from 'vitest'
import { findWarnings, summarizeIssues } from './issues'
import type { Transaction } from './types'

const txn = (o: Partial<Transaction>): Transaction => ({
  paymentId: 'p1', invoiceNumber: 'inv1', date: new Date('2026-01-01'), month: '2026-01',
  customerId: 'c1', name: 'Acme', country: 'US', region: 'NA', businessModel: 'sub',
  currency: 'USD', amountNative: 100, amountBase: 100, isRefund: false, ...o,
})

describe('findWarnings', () => {
  it('flags a blank optional field', () => {
    const warnings = findWarnings([txn({ country: null })])
    expect(warnings.some((w) => w.kind === 'blank' && w.field === 'country')).toBe(true)
  })
  it('does not flag a populated optional field', () => {
    const warnings = findWarnings([txn({})])
    expect(warnings.some((w) => w.kind === 'blank')).toBe(false)
  })
  it('flags duplicate payment IDs', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1' }), txn({ paymentId: 'p1' })])
    expect(warnings.some((w) => w.kind === 'duplicateId' && w.field === 'paymentId')).toBe(true)
  })
  it('does not flag a unique payment id', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1', invoiceNumber: 'i1' }), txn({ paymentId: 'p2', invoiceNumber: 'i2' })])
    expect(warnings.some((w) => w.kind === 'duplicateId')).toBe(false)
  })
  it('flags duplicate rows sharing customer, date, amount, currency', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1' }), txn({ paymentId: 'p2' })])
    expect(warnings.some((w) => w.kind === 'duplicateRow')).toBe(true)
  })
  it('does not flag rows with different amounts as duplicates', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1', amountNative: 100 }), txn({ paymentId: 'p2', amountNative: 200 })])
    expect(warnings.some((w) => w.kind === 'duplicateRow')).toBe(false)
  })
})

describe('summarizeIssues', () => {
  it('groups blocking issues by category with an items list', () => {
    const groups = summarizeIssues([
      { id: 'row:0', blocking: true, rowIndex: 0, kind: 'date', field: 'date', reason: 'Unparseable date: "x"', raw: {} },
    ])
    expect(groups[0].category).toBe('Dates')
    expect(groups[0].items).toHaveLength(1)
  })
})
