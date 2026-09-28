import type { MrrMode, Transaction } from './types'
import { monthDiff } from './types'
import { buildMatrix, mrrOf, get, activeCustomers } from './engine/matrix'
import { nrr, grr, logoChurnRate } from './engine/kpis'

export type GeoDim = 'country' | 'region'

export type MarketRow = {
  key: string; mrr: number; share: number; customers: number; arpa: number | null
  growth: number | null   // compound monthly MRR growth over the trailing window
  nrr: number | null; grr: number | null; churn: number | null // churn = avg monthly logo churn, last 3 mo
  newLogos: number        // first payment in the last 3 months
  refundRate: number | null
  firstMonth: string      // market entry: first month with revenue
  spark: number[]
}

const WINDOW = 6 // months for growth
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null)

/** Performance of each market (country or region) on a shared month axis. */
export function marketStats(txs: Transaction[], dim: GeoDim, mode: MrrMode): { months: string[]; rows: MarketRow[] } {
  const all = buildMatrix(txs, mode)
  const months = all.months
  if (!months.length) return { months, rows: [] }
  const last = months[months.length - 1]
  const range: [string, string] = [months[0], last]
  const total = mrrOf(all, last)

  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    const k = t[dim] ?? 'Unknown'
    const g = groups.get(k); if (g) g.push(t); else groups.set(k, [t])
  }

  const rows = [...groups].map(([key, g]): MarketRow => {
    const m = buildMatrix(g, mode, range)
    const mrr = mrrOf(m, last)
    const customers = activeCustomers(m, last)
    const series = months.map((mo) => mrrOf(m, mo))
    const firstIdx = series.findIndex((v) => v !== 0)
    const base = months[Math.max(firstIdx, months.length - 1 - WINDOW)]
    const span = monthDiff(base, last)
    const b = mrrOf(m, base)
    const growth = span > 0 && b > 0 && mrr > 0 ? Math.pow(mrr / b, 1 / span) - 1 : null
    const start = months[Math.max(firstIdx, months.length - 13)]
    const last4 = months.slice(-4)
    const churns = last4.slice(1).map((mo, i) => logoChurnRate(m, last4[i], mo)).filter((x): x is number => x != null)
    const recent = new Set(months.slice(-3))
    const newLogos = m.customers.filter((c) => recent.has(months.find((mo) => get(m, c, mo) !== 0) ?? '')).length
    const gross = g.filter((t) => t.amountBase > 0).reduce((s, t) => s + t.amountBase, 0)
    const refunds = g.filter((t) => t.amountBase < 0).reduce((s, t) => s - t.amountBase, 0)
    return {
      key, mrr, share: total ? mrr / total : 0, customers, arpa: customers ? mrr / customers : null,
      growth, nrr: start !== last ? nrr(m, start, last) : null, grr: start !== last ? grr(m, start, last) : null,
      churn: mean(churns), newLogos, refundRate: gross ? refunds / gross : null,
      firstMonth: months[Math.max(0, firstIdx)], spark: series,
    }
  }).sort((a, b) => b.mrr - a.mrr)
  return { months, rows }
}

/** Base currency = the one whose native amount equals the converted amount most often. */
export function baseCurrency(txs: Transaction[]): string | null {
  const n = new Map<string, number>()
  for (const t of txs) if (t.currency && t.amountNative === t.amountBase) n.set(t.currency, (n.get(t.currency) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

/** Latest-month revenue per billing currency, plus how much of it is FX-exposed. */
export function currencyExposure(txs: Transaction[], lastMonth: string) {
  const base = baseCurrency(txs)
  const cur = new Map<string, number>()
  for (const t of txs) if (t.month === lastMonth) cur.set(t.currency ?? base ?? '—', (cur.get(t.currency ?? base ?? '—') ?? 0) + t.amountBase)
  const total = [...cur.values()].reduce((s, v) => s + v, 0)
  const rows = [...cur].map(([ccy, v]) => ({ ccy, revenue: v, share: total ? v / total : 0, foreign: ccy !== base })).sort((a, b) => b.revenue - a.revenue)
  const foreign = rows.filter((r) => r.foreign).reduce((s, r) => s + r.revenue, 0)
  return { base, rows, foreign, foreignShare: total ? foreign / total : 0 }
}

// Export spellings → Natural Earth (world-atlas 110m) names, lowercased.
const ATLAS_ALIAS: Record<string, string> = {
  usa: 'united states of america', us: 'united states of america', 'united states': 'united states of america', america: 'united states of america',
  uk: 'united kingdom', 'great britain': 'united kingdom', england: 'united kingdom', scotland: 'united kingdom', wales: 'united kingdom',
  uae: 'united arab emirates', 'czech republic': 'czechia', korea: 'south korea', 'republic of korea': 'south korea',
  'dominican republic': 'dominican rep.', 'ivory coast': "côte d'ivoire", "cote d'ivoire": "côte d'ivoire",
  'bosnia and herzegovina': 'bosnia and herz.', drc: 'dem. rep. congo', 'democratic republic of the congo': 'dem. rep. congo',
  'central african republic': 'central african rep.', 'north macedonia': 'macedonia', swaziland: 'eswatini',
  'russian federation': 'russia', 'viet nam': 'vietnam', holland: 'netherlands', 'the netherlands': 'netherlands',
  türkiye: 'turkey', turkiye: 'turkey', 'south sudan': 's. sudan', 'solomon islands': 'solomon is.', 'equatorial guinea': 'eq. guinea',
}
/** Key used to join a market to a world-atlas country shape. */
export const atlasKey = (country: string) => { const k = country.trim().toLowerCase(); return ATLAS_ALIAS[k] ?? k }

// Centroids [lat, lon] for countries too small for the 110m atlas (drawn as dots instead).
const C: [string[], number, number][] = [
  [['singapore'], 1.35, 103.8], [['hong kong'], 22.3, 114.2], [['malta'], 35.9, 14.4], [['bahrain'], 26.0, 50.55],
  [['mauritius'], -20.3, 57.6], [['monaco'], 43.73, 7.42], [['andorra'], 42.5, 1.5], [['liechtenstein'], 47.16, 9.55],
  [['barbados'], 13.19, -59.54], [['maldives'], 3.2, 73.2], [['seychelles'], -4.68, 55.49], [['macau', 'macao'], 22.2, 113.55],
]
const LOOKUP = new Map(C.flatMap(([names, lat, lon]) => names.map((n) => [n, { name: names[0], lat, lon }] as const)))
/** Centroid for small countries missing from the atlas; null otherwise. */
export const geoOf = (country: string) => LOOKUP.get(country.trim().toLowerCase()) ?? null
