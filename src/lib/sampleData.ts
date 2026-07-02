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
const PREFIX = ['Nova', 'Apex', 'Orbit', 'Vertex', 'Lumen', 'Quanta', 'Delta', 'Helix', 'Cobalt', 'Sable', 'Terra', 'Vela', 'Astra', 'Onyx', 'Flux', 'Zenith', 'Meridian', 'Halcyon', 'Cinder', 'Pallas']
const SUFFIX = ['Labs', 'Systems', 'Group', 'Digital', 'Cloud', 'Works', 'Analytics', 'Retail', 'Health', 'Foods', 'Capital', 'Logistics']

/** Realistic 18-month multi-region/model/currency payment log with churn, expansion, reactivation and refunds. */
export function sampleTransactions(): Transaction[] {
  const rand = mulberry32(20260702)
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
      // expansion / contraction drift
      if (rand() < expand) base = Math.round(base * (1.05 + rand() * 0.25))
      else if (rand() < 0.05) base = Math.round(base * (0.75 + rand() * 0.15))

      const amountBase = base
      const rate = RATE[currency] ?? 1
      const month = months[i]
      const day = 1 + Math.floor(rand() * 26)
      const date = new Date(`${month}-${String(day).padStart(2, '0')}T00:00:00Z`)
      const invoiceNumber = `INV-${inv++}`
      txs.push({
        paymentId: `P${pid++}`, invoiceNumber, date, month, customerId, name, country, region,
        businessModel: model, currency, amountNative: Math.round(amountBase / rate), amountBase, isRefund: false,
      })
      // occasional refund a month later, linked by invoice
      if (rand() < 0.03 && i + 1 < months.length) {
        const rMonth = months[i + 1]
        const rDate = new Date(`${rMonth}-05T00:00:00Z`)
        txs.push({
          paymentId: `P${pid++}`, invoiceNumber, date: rDate, month: rMonth, customerId, name, country, region,
          businessModel: model, currency, amountNative: -Math.round(amountBase / rate), amountBase: -amountBase, isRefund: true,
        })
      }
      // churn check
      if (rand() < monthlyChurn) { alive = false; churnedAt = i }
    }
  }
  return txs
}
