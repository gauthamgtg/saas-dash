/**
 * Product / collections metrics that need Stripe events or usage data.
 * Exposed as schemas + empty-state helpers; live when data is connected later.
 */

export type DunningEvent = {
  month: string
  failedCount: number
  recoveredCount: number
  failedAmount: number
  recoveredAmount: number
}

export type UsageRow = {
  month: string
  customerId: string
  seats: number
  activeUsers: number
  featureKey?: string
}

export type DeferredRow = {
  month: string
  bookedArr: number
  recognizedRevenue: number
  deferredBalance: number
}

export const DUNNING_TEMPLATE = [
  { month: '2026-01', failed_count: 12, recovered_count: 8, failed_amount: 4200, recovered_amount: 2800 },
  { month: '2026-02', failed_count: 15, recovered_count: 11, failed_amount: 5100, recovered_amount: 3700 },
]

export const USAGE_TEMPLATE = [
  { month: '2026-01', customer_id: 'c1', seats: 10, active_users: 7, feature_key: 'reports' },
  { month: '2026-01', customer_id: 'c2', seats: 5, active_users: 5, feature_key: 'api' },
]

export const DEFERRED_TEMPLATE = [
  { month: '2026-01', booked_arr: 120000, recognized_revenue: 90000, deferred_balance: 30000 },
  { month: '2026-02', booked_arr: 130000, recognized_revenue: 95000, deferred_balance: 35000 },
]

export function dunningRecoveryRate(events: DunningEvent[]): number | null {
  const failed = events.reduce((s, e) => s + e.failedCount, 0)
  const recovered = events.reduce((s, e) => s + e.recoveredCount, 0)
  return failed ? recovered / failed : null
}

export function seatArpu(usage: UsageRow[], mrrByCustomer: Map<string, number>): number | null {
  let seats = 0, mrr = 0
  const latest = new Map<string, UsageRow>()
  for (const u of usage) latest.set(u.customerId, u)
  for (const [id, u] of latest) {
    seats += u.seats
    mrr += mrrByCustomer.get(id) ?? 0
  }
  return seats > 0 ? mrr / seats : null
}
