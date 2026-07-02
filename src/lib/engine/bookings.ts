import type { Transaction } from '../types'

/** Gross (pre-refund) → net revenue bridge, in base currency. */
export function refundBridge(txs: Transaction[]): { gross: number; refunded: number; net: number; refundPct: number | null } {
  let gross = 0, refunded = 0
  for (const t of txs) {
    if (t.isRefund) refunded += Math.abs(t.amountBase)
    else gross += t.amountBase
  }
  return { gross, refunded, net: gross - refunded, refundPct: gross > 0 ? refunded / gross : null }
}

/** Refunded fraction of gross revenue (dissatisfaction proxy). */
export function refundRate(txs: Transaction[]): number | null {
  return refundBridge(txs).refundPct
}

/** Invoice / payment aggregates. netTotal = gross − refunds. */
export function invoiceStats(txs: Transaction[]): {
  distinctInvoices: number; distinctPayments: number; avgInvoiceValue: number | null; avgPaymentSize: number | null
} {
  const invoices = new Set<string>()
  const payments = new Set<string>()
  let net = 0
  for (const t of txs) {
    net += t.amountBase
    if (t.invoiceNumber) invoices.add(t.invoiceNumber)
    if (t.paymentId) payments.add(t.paymentId)
  }
  return {
    distinctInvoices: invoices.size,
    distinctPayments: payments.size,
    avgInvoiceValue: invoices.size ? net / invoices.size : null,
    avgPaymentSize: payments.size ? net / payments.size : null,
  }
}
