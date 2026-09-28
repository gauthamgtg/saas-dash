import type { Transaction } from './types'
import type { SpendRow } from './spend'
import type { PipelineDeal, PipelineStage } from './pipeline'
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
  { plan: 'Growth', month: '2026-01', factor: 1.12 },
  { plan: 'Starter', month: '2026-05', factor: 1.08 },
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

/** Last month of the demo dataset; everything else (spend, pipeline, price changes) is anchored to it. */
export const DEMO_END = '2026-09'
const WINDOW = 24
export const DEMO_SEED = 90
const MODEL_MIX: [string, number][] = [['Self-Serve', 0.38], ['SMB', 0.32], ['Marketplace', 0.14], ['Enterprise', 0.16]]
const EXISTING_SHARE = 0.35 // accounts already paying when the export window opens

/** Realistic 24-month multi-region/model/currency payment log with churn, expansion, reactivation and refunds. */
export function sampleTransactions(seed = DEMO_SEED): Transaction[] {
  const rand = mulberry32(seed)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const weighted = <T,>(opts: [T, number][]) => { let r = rand(); for (const [v, w] of opts) if ((r -= w) < 0) return v; return opts[opts.length - 1][0] }
  const months = monthRange(addMonths(DEMO_END, -(WINDOW - 1)), DEMO_END)
  // unique company names: shuffled prefix × suffix combos
  const names = PREFIX.flatMap((p) => SUFFIX.map((x) => `${p} ${x}`)).map((n) => [rand(), n] as const).sort((x, y) => x[0] - y[0]).map(([, n]) => n)
  // signups accelerate over the window (weight grows linearly), so growth compounds instead of arriving flat
  const signupW = months.map((_, i) => (i === 0 ? 0 : 1 + (1.5 * i) / (months.length - 1)))
  const signupTotal = signupW.reduce((x, y) => x + y, 0)
  const signupMonth = () => { let r = rand() * signupTotal; for (let i = 0; i < signupW.length; i++) if ((r -= signupW[i]) < 0) return i; return months.length - 1 }
  const txs: Transaction[] = []
  let pid = 1000, inv = 5000

  const N = 150
  for (let c = 0; c < N; c++) {
    const region = pick(Object.keys(REGIONS))
    const country = pick(REGIONS[region])
    const model = weighted(MODEL_MIX)
    const currency = model === 'Enterprise' && region === 'Europe' ? 'GBP' : CCY_BY_REGION[region]
    const name = names[c]
    const customerId = `C${String(c + 1).padStart(3, '0')}`
    let planIdx = PLAN_IDX_BY_MODEL[model]
    // self-serve accounts mostly have no rep; sold accounts get a stable owner
    const salesRep = model === 'Self-Serve' && rand() < 0.7 ? 'Self-serve (no rep)' : pick(REPS.slice(0, 5))
    // Enterprise pays more; self-serve less. Base monthly revenue in USD.
    const tier = model === 'Enterprise' ? 2400 : model === 'SMB' ? 520 : model === 'Marketplace' ? 1100 : 140
    let base = Math.round(tier * (0.5 + rand() * 1.2))
    const startIdx = rand() < EXISTING_SHARE ? 0 : signupMonth()
    const monthlyChurn = model === 'Enterprise' ? 0.005 : model === 'Self-Serve' ? 0.03 : 0.011
    const expand = model === 'Enterprise' ? 0.15 : 0.08

    const billDay = 1 + Math.floor(rand() * 24) // subscriptions renew on a stable anniversary day
    let alive = true, fading = false
    let churnedAt = -1
    for (let i = startIdx; i < months.length; i++) {
      if (!alive) {
        // small chance to reactivate after ≥2 dormant months
        if (i - churnedAt >= 2 && rand() < 0.06) { alive = true; fading = false; base = Math.round(base * 0.9) }
        else continue
      }
      const month = months[i]
      const priceChange = PRICE_CHANGES.find((pc) => pc.month === month && pc.plan === PLANS[planIdx])
      // a few accounts start fading — shrinking seats and paying late — before most of them churn
      if (!fading && i > startIdx + 2 && rand() < 0.005) fading = true
      if (fading) {
        if (rand() < 0.2) continue // skipped / failed payment
        base = Math.round(base * (0.8 + rand() * 0.1))
      } else if (priceChange && i > startIdx) {
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
      const day = Math.min(28, billDay + (fading ? 2 + Math.floor(rand() * 4) : Math.floor(rand() * 2)))
      const date = new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00Z`)
      const invoiceNumber = `INV-${inv++}`
      txs.push({
        paymentId: `P${pid++}`, invoiceNumber, date, month, customerId, name, country, region,
        businessModel: model, plan, salesRep, currency, amountNative: Math.round(amountBase / rate), amountBase, isRefund: false,
      })
      // occasional refund a month later, linked by invoice
      if (rand() < 0.012 && i + 1 < months.length) {
        const rMonth = months[i + 1]
        const rDate = new Date(`${rMonth}-05T00:00:00Z`)
        txs.push({
          paymentId: `P${pid++}`, invoiceNumber, date: rDate, month: rMonth, customerId, name, country, region,
          businessModel: model, plan, salesRep, currency, amountNative: -Math.round(amountBase / rate), amountBase: -amountBase, isRefund: true,
        })
      }
      // churn check — price increases lift churn on the affected plan for the next quarter
      const recentHike = PRICE_CHANGES.some((pc) => pc.plan === plan && pc.month <= month && month < addMonths(pc.month, 3))
      if (rand() < monthlyChurn * (recentHike ? 2.2 : 1) * (fading ? 5 : 1)) { alive = false; churnedAt = i }
    }
  }
  return txs
}

const SPEND_CHANNELS: { channel: string; category: SpendRow['category']; base: number }[] = [
  { channel: 'Google Ads', category: 'marketing', base: 6200 },
  { channel: 'LinkedIn Ads', category: 'marketing', base: 3800 },
  { channel: 'Content & SEO', category: 'marketing', base: 2400 },
  { channel: 'Events', category: 'marketing', base: 1800 },
  { channel: 'SDR team', category: 'sales', base: 7500 },
  { channel: 'Account executives', category: 'sales', base: 9000 },
  { channel: 'R&D payroll', category: 'other', base: 85000 },
  { channel: 'Infrastructure', category: 'other', base: 10000 },
  { channel: 'G&A', category: 'other', base: 16000 },
]

/** Demo monthly spend matching the sample window — lights up Unit Economics and Efficiency Lab. */
export function sampleSpend(): SpendRow[] {
  const rand = mulberry32(4242)
  const months = monthRange(addMonths(DEMO_END, -(WINDOW - 1)), DEMO_END)
  // costs ramp ~40% across the window; events are lumpy
  return months.flatMap((month, i) => SPEND_CHANNELS.map(({ channel, category, base }) => ({
    month, channel, category,
    amount: Math.round(base * (1 + (0.4 * i) / (months.length - 1)) * (channel === 'Events' ? (rand() < 0.3 ? 3 : 0.4) : 0.9 + rand() * 0.2)),
  })))
}

const STAGE_PROB: Record<PipelineStage, number> = { lead: 0.1, qualified: 0.25, proposal: 0.45, negotiation: 0.7, won: 1, lost: 0 }

/** Demo CRM opportunities: closed deals in the last quarter, open ones over the next two. */
export function samplePipeline(): PipelineDeal[] {
  const rand = mulberry32(777)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const sources = ['Inbound', 'Outbound', 'Partner', 'Event', 'Referral']
  return Array.from({ length: 48 }, (_, i) => {
    const closed = rand() < 0.35
    const stage: PipelineStage = closed ? (rand() < 0.45 ? 'won' : 'lost') : pick(['lead', 'qualified', 'qualified', 'proposal', 'proposal', 'negotiation'])
    return {
      dealId: `D-${2001 + i}`, name: `${pick(PREFIX)} ${pick(SUFFIX)}`, stage,
      amount: Math.round((6000 + rand() * rand() * 90000) / 500) * 500,
      closeMonth: addMonths(DEMO_END, closed ? -Math.floor(rand() * 3) : 1 + Math.floor(rand() * 6)),
      owner: pick(REPS.slice(0, 5)), source: pick(sources), probability: STAGE_PROB[stage],
    }
  })
}
