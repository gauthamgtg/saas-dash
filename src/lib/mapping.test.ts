import { describe, it, expect } from 'vitest'
import { autoDetect, missingRequired, REQUIRED_FIELDS } from './mapping'

describe('autoDetect', () => {
  it('maps known headers case/space/underscore-insensitively', () => {
    const m = autoDetect([
      'Payment ID', 'Invoice Number', 'Date', 'customer_id', 'Name',
      'Country', 'Business Model', 'Currency', 'Overall Revenue', 'Refund Flag', 'Region',
    ])
    expect(m.date).toBe('Date')
    expect(m.customerId).toBe('customer_id')
    expect(m.amount).toBe('Overall Revenue')
    expect(m.businessModel).toBe('Business Model')
    expect(m.refundFlag).toBe('Refund Flag')
  })
  it('leaves unknown fields null and reports required gaps', () => {
    const m = autoDetect(['foo', 'bar'])
    expect(m.date).toBeNull()
    expect(missingRequired(m).sort()).toEqual([...REQUIRED_FIELDS].sort())
  })
})
