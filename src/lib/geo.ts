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

// Approximate country centroids [lat, lon] for the tile map. Aliases share coordinates.
const C: [string[], number, number][] = [
  [['united states', 'usa', 'us', 'united states of america'], 39, -98], [['canada'], 58, -100], [['mexico'], 23, -102],
  [['brazil'], -10, -52], [['argentina'], -36, -64], [['chile'], -33, -71], [['colombia'], 4, -73], [['peru'], -10, -76],
  [['united kingdom', 'uk', 'great britain', 'england'], 54, -2], [['ireland'], 53, -8], [['france'], 46, 2], [['spain'], 40, -4],
  [['portugal'], 39, -8], [['germany'], 51, 10], [['netherlands'], 52, 5], [['belgium'], 50.5, 4.5], [['switzerland'], 47, 8],
  [['italy'], 42, 12], [['austria'], 47.5, 14], [['poland'], 52, 19], [['sweden'], 62, 16], [['norway'], 64, 11],
  [['denmark'], 56, 10], [['finland'], 64, 26], [['ukraine'], 49, 32], [['russia'], 60, 90], [['turkey'], 39, 35],
  [['israel'], 31, 35], [['egypt'], 26, 30], [['saudi arabia'], 24, 45], [['united arab emirates', 'uae'], 24, 54],
  [['nigeria'], 9, 8], [['kenya'], 0, 38], [['south africa'], -30, 25], [['india'], 21, 78], [['pakistan'], 30, 70],
  [['china'], 35, 104], [['japan'], 36, 138], [['south korea'], 36, 128], [['vietnam'], 16, 107], [['thailand'], 15, 101],
  [['malaysia'], 3.5, 102], [['singapore'], 1.3, 104], [['indonesia'], -2, 118], [['philippines'], 12, 122],
  [['australia'], -25, 134], [['new zealand'], -41, 174],
]
const LOOKUP = new Map(C.flatMap(([names, lat, lon]) => names.map((n) => [n, { name: names[0], lat, lon }] as const)))
export const geoOf = (country: string) => LOOKUP.get(country.trim().toLowerCase()) ?? null

export type Tile = { name: string; col: number; row: number }
/**
 * Equirectangular projection onto a coarse grid, nudging collisions to the nearest free cell.
 * ponytail: a stylised tile map instead of shipping country polygons.
 */
export function tileLayout(cols = 30, rows = 14): Tile[] {
  const taken = new Set<string>()
  const out: Tile[] = []
  for (const [names, lat, lon] of C) {
    const c0 = Math.round(((lon + 180) / 360) * (cols - 1)), r0 = Math.round(((75 - lat) / 125) * (rows - 1))
    let placed = false
    for (let d = 0; d < 6 && !placed; d++) {
      for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const col = c0 + dc * d, row = r0 + dr * d, k = `${col},${row}`
        if (d === 0 && (dc || dr)) continue
        if (col < 0 || row < 0 || col >= cols || row >= rows || taken.has(k)) continue
        taken.add(k); out.push({ name: names[0], col, row }); placed = true; break
      }
    }
  }
  return out
}
