import { describe, it, expect } from 'vitest'
import { refundBridge, refundRate, invoiceStats } from './bookings'
import { tx } from '../testdata'

const data = [
  tx({ customerId: 'a', month: '2026-01', amountBase: 100, paymentId: 'p1', invoiceNumber: 'i1' }),
  tx({ customerId: 'a', month: '2026-01', amountBase: 300, paymentId: 'p2', invoiceNumber: 'i1' }), // same invoice
  tx({ customerId: 'b', month: '2026-02', amountBase: -40, paymentId: 'p3', invoiceNumber: 'i2', isRefund: true }),
]

describe('bookings', () => {
  it('bridges gross to net', () => {
    const b = refundBridge(data)
    expect(b.gross).toBe(400)
    expect(b.refunded).toBe(40)
    expect(b.net).toBe(360)
    expect(b.refundPct).toBeCloseTo(40 / 400)
    expect(refundRate(data)).toBeCloseTo(0.1)
  })
  it('counts distinct invoices/payments and averages on net', () => {
    const s = invoiceStats(data)
    expect(s.distinctInvoices).toBe(2) // i1, i2
    expect(s.distinctPayments).toBe(3)
    expect(s.avgInvoiceValue).toBeCloseTo(360 / 2) // net / distinct invoices
    expect(s.avgPaymentSize).toBeCloseTo(360 / 3)
  })
})
