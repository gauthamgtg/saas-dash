import Stripe from 'stripe'
import { monthKey } from '@/src/lib/types'

export type StripeMrrSnapshot = {
  mrr: number
  arr: number
  customerCount: number
  currency: string
  accountEmail: string | null
  accountId: string | null
  sparkline: number[]
  month: string
}

/**
 * Compute MRR from active Stripe subscriptions using a restricted/read-only secret key.
 * Uses subscription items' recurring prices (quantity × unit_amount).
 */
export async function syncStripeMrr(secretKey: string): Promise<StripeMrrSnapshot> {
  if (!secretKey.startsWith('sk_') && !secretKey.startsWith('rk_')) {
    throw new Error('Use a Stripe secret key (sk_…) or restricted key (rk_…). Never use a publishable key.')
  }

  const stripe = new Stripe(secretKey)

  let accountEmail: string | null = null
  let accountId: string | null = null
  try {
    // Restricted keys may not allow account retrieve — ignore failures
    const acct = await (stripe.accounts as { retrieve: (id?: string) => Promise<{ id: string; email?: string | null }> }).retrieve()
    accountId = acct.id
    accountEmail = acct.email ?? null
  } catch {
    // continue with subscriptions
  }

  let mrrCents = 0
  let currency = 'usd'
  const customerIds = new Set<string>()

  for await (const sub of stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] })) {
    if (sub.customer) customerIds.add(typeof sub.customer === 'string' ? sub.customer : sub.customer.id)
    for (const item of sub.items.data) {
      const price = item.price
      if (!price || price.type !== 'recurring' || !price.recurring) continue
      const unit = price.unit_amount ?? 0
      const qty = item.quantity ?? 1
      const interval = price.recurring.interval
      const count = Math.max(1, price.recurring.interval_count || 1)
      let monthly = unit * qty
      if (interval === 'year') monthly = monthly / (12 * count)
      else if (interval === 'week') monthly = (monthly * 52) / (12 * count)
      else if (interval === 'day') monthly = (monthly * 30.4375) / count
      else if (interval === 'month') monthly = monthly / count
      mrrCents += monthly
      if (price.currency) currency = price.currency
    }
  }

  const mrr = mrrCents / 100
  const month = monthKey(new Date())
  // Without historical Stripe reporting API access, sparkline is flat current MRR (honest).
  const sparkline = Array.from({ length: 12 }, () => Math.round(mrr))

  return {
    mrr,
    arr: mrr * 12,
    customerCount: customerIds.size,
    currency: currency.toUpperCase(),
    accountEmail,
    accountId,
    sparkline,
    month,
  }
}

export function currentMonth(): string {
  return monthKey(new Date())
}
