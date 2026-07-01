import type { Transaction } from './types'

let seq = 0
export function tx(p: Partial<Transaction> & { customerId: string; month: string; amountBase: number }): Transaction {
  const [y, m] = p.month.split('-').map(Number)
  return {
    paymentId: p.paymentId ?? `p${seq++}`,
    invoiceNumber: p.invoiceNumber ?? `i${seq}`,
    date: p.date ?? new Date(Date.UTC(y, m - 1, 15)),
    month: p.month,
    customerId: p.customerId,
    name: p.name ?? p.customerId,
    country: p.country ?? 'US',
    region: p.region ?? 'NA',
    businessModel: p.businessModel ?? 'sub',
    currency: p.currency ?? 'USD',
    amountNative: p.amountNative ?? p.amountBase,
    amountBase: p.amountBase,
    isRefund: p.isRefund ?? p.amountBase < 0,
  }
}

/**
 * Scenario used across engine tests:
 *  c1: 100 in Jan, 150 in Feb (expansion), 150 in Mar (retained)
 *  c2: 200 in Jan, 0 in Feb (churn), 200 in Mar (reactivation, gap 1)
 *  c3: new 300 in Feb, 250 in Mar (contraction)
 */
export function scenario(): Transaction[] {
  return [
    tx({ customerId: 'c1', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'c1', month: '2026-02', amountBase: 150 }),
    tx({ customerId: 'c1', month: '2026-03', amountBase: 150 }),
    tx({ customerId: 'c2', month: '2026-01', amountBase: 200 }),
    tx({ customerId: 'c2', month: '2026-03', amountBase: 200 }),
    tx({ customerId: 'c3', month: '2026-02', amountBase: 300, businessModel: 'onetime', region: 'EU' }),
    tx({ customerId: 'c3', month: '2026-03', amountBase: 250, businessModel: 'onetime', region: 'EU' }),
  ]
}
