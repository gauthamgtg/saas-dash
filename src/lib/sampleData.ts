import type { Transaction } from './types'
import { monthRange, addMonths } from './types'

/** Deterministic PRNG so the demo dataset is identical every load. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS: Record<string, string[]> = {
  'North America': ['United States', 'Canada'],
  Europe: ['United Kingdom', 'Germany', 'France'],
  APAC: ['India', 'Australia', 'Singapore'],
  LATAM: ['Brazil', 'Mexico'],
}
const CCY_BY_REGION: Record<string, string> = { 'North America': 'USD', Europe: 'EUR', APAC: 'INR', LATAM: 'USD' }
const RATE: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012 }
const MODELS = ['Self-Serve', 'SMB', 'Enterprise', 'Marketplace']
// Plan ladder — accounts start on their model's plan and can upgrade / downgrade over time.
const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']
const PLAN_IDX_BY_MODEL: Record<string, number> = { 'Self-Serve': 0, SMB: 1, Marketplace: 2, Enterprise: 3 }
// List-price changes baked into the demo so the price-change detector has something real to find.
const PRICE_CHANGES: { plan: string; month: string; factor: number }[] = [
  { plan: 'Growth', month: '2025-11', factor: 1.12 },
  { plan: 'Starter', month: '2026-03', factor: 1.08 },
]
const REPS = ['Ava Chen', 'Marcus Reid', 'Priya Nair', 'Diego Torres', 'Sofia Berg', 'Self-serve (no rep)']
const PREFIX = ['Nova', 'Apex', 'Orbit', 'Vertex', 'Lumen', 'Quanta', 'Delta', 'Helix', 'Cobalt', 'Sable', 'Terra', 'Vela', 'Astra', 'Onyx', 'Flux', 'Zenith', 'Meridian', 'Halcyon', 'Cinder', 'Pallas']
const SUFFIX = ['Labs', 'Systems', 'Group', 'Digital', 'Cloud', 'Works', 'Analytics', 'Retail', 'Health', 'Foods', 'Capital', 'Logistics']

/** Upload-shaped rows of the demo dataset — download, edit with your own data, re-upload. Headers auto-detect. */
export function sampleCsvRows(): Record<string, unknown>[] {
  return sampleTransactions().map((t) => ({
    payment_id: t.paymentId, invoice_number: t.invoiceNumber, date: t.date.toISOString().slice(0, 10),
    customer_id: t.customerId, customer_name: t.name, country: t.country, region: t.region,
    business_model: t.businessModel, plan: t.plan, sales_rep: t.salesRep, currency: t.currency,
    amount: t.amountNative, refund_flag: t.isRefund ? 'true' : 'false',
  }))
}

/** Realistic 18-month multi-region/model/currency payment log with churn, expansion, reactivation and refunds. */
export function sampleTransactions(): Transaction[] {
  const rand = mulberry32(31337)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const end = '2026-06'
  const start = addMonths(end, -17)
  const months = monthRange(start, end)
  const txs: Transaction[] = []
  let pid = 1000, inv = 5000

  const N = 52
  for (let c = 0; c < N; c++) {
    const region = pick(Object.keys(REGIONS))
    const country = pick(REGIONS[region])
    const model = pick(MODELS)
    const currency = model === 'Enterprise' && region === 'Europe' ? 'GBP' : CCY_BY_REGION[region]
    const name = `${pick(PREFIX)} ${pick(SUFFIX)}`
    const customerId = `C${String(c + 1).padStart(3, '0')}`
    let planIdx = PLAN_IDX_BY_MODEL[model]
    // self-serve accounts mostly have no rep; sold accounts get a stable owner
    const salesRep = model === 'Self-Serve' && rand() < 0.7 ? 'Self-serve (no rep)' : pick(REPS.slice(0, 5))
    // Enterprise pays more; self-serve less. Base monthly revenue in USD.
    const tier = model === 'Enterprise' ? 2600 : model === 'SMB' ? 700 : model === 'Marketplace' ? 1400 : 220
    let base = Math.round(tier * (0.5 + rand() * 1.4))
    const startIdx = Math.floor(rand() * months.length) // signups land across the whole window
    const monthlyChurn = model === 'Enterprise' ? 0.01 : model === 'Self-Serve' ? 0.045 : 0.022
    const expand = model === 'Enterprise' ? 0.16 : 0.09

    let alive = true
    let churnedAt = -1
    for (let i = startIdx; i < months.length; i++) {
      if (!alive) {
        // small chance to reactivate after ≥2 dormant months
        if (i - churnedAt >= 2 && rand() < 0.06) { alive = true; base = Math.round(base * 0.9) }
        else continue
      }
      const month = months[i]
      const priceChange = PRICE_CHANGES.find((pc) => pc.month === month && pc.plan === PLANS[planIdx])
      if (priceChange && i > startIdx) {
        // list price move replaces this month's organic drift for everyone on the plan
        base = Math.round(base * priceChange.factor)
      } else if (rand() < expand) {
        base = Math.round(base * (1.05 + rand() * 0.25))
        if (rand() < 0.3 && planIdx < PLANS.length - 1) { planIdx++; base = Math.round(base * 1.15) } // upgrade
      } else if (rand() < 0.05) {
        base = Math.round(base * (0.75 + rand() * 0.15))
        if (rand() < 0.45 && planIdx > 0) planIdx-- // downgrade
      }
      const plan = PLANS[planIdx]

      const amountBase = base
      const rate = RATE[currency] ?? 1
      const day = 1 + Math.floor(rand() * 26)
      const date = new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00Z`)
      const invoiceNumber = `INV-${inv++}`
      txs.push({
        paymentId: `P${pid++}`, invoiceNumber, date, month, customerId, name, country, region,
        businessModel: model, plan, salesRep, currency, amountNative: Math.round(amountBase / rate), amountBase, isRefund: false,
      })
      // occasional refund a month later, linked by invoice
      if (rand() < 0.03 && i + 1 < months.length) {
        const rMonth = months[i + 1]
        const rDate = new Date(`${rMonth}-05T00:00:00Z`)
        txs.push({
          paymentId: `P${pid++}`, invoiceNumber, date: rDate, month: rMonth, customerId, name, country, region,
          businessModel: model, plan, salesRep, currency, amountNative: -Math.round(amountBase / rate), amountBase: -amountBase, isRefund: true,
        })
      }
      // churn check — price increases lift churn on the affected plan for the next quarter
      const recentHike = PRICE_CHANGES.some((pc) => pc.plan === plan && pc.month <= month && month < addMonths(pc.month, 3))
      if (rand() < monthlyChurn * (recentHike ? 2.2 : 1)) { alive = false; churnedAt = i }
    }
  }
  return txs
}
