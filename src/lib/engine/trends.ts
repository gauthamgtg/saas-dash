import type { Matrix, Transaction } from '../types'
import { get, activeCustomers } from './matrix'
import { monthRange } from '../types'

/** Active (nonzero) customers per month. */
export function activeSeries(m: Matrix): { month: string; active: number }[] {
  return m.months.map((mo) => ({ month: mo, active: activeCustomers(m, mo) }))
}

function firstActiveMonth(m: Matrix, c: string): string | null {
  for (const mo of m.months) if (get(m, c, mo) !== 0) return mo
  return null
}

/** New logos per month = customers whose first-ever active month is that month. */
export function newLogosSeries(m: Matrix): { month: string; newLogos: number }[] {
  const counts = new Map<string, number>(m.months.map((mo) => [mo, 0]))
  for (const c of m.customers) {
    const f = firstActiveMonth(m, c)
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  return m.months.map((mo) => ({ month: mo, newLogos: counts.get(mo) ?? 0 }))
}

/** Logo adds (first-active this month) vs losses (active last month, gone this month). */
export function netLogoSeries(m: Matrix): { month: string; adds: number; losses: number; net: number }[] {
  const first = new Map<string, string>()
  for (const c of m.customers) { const f = firstActiveMonth(m, c); if (f) first.set(c, f) }
  return m.months.map((mo, i) => {
    let adds = 0, losses = 0
    for (const c of m.customers) {
      const cur = get(m, c, mo) !== 0
      const prev = i > 0 && get(m, c, m.months[i - 1]) !== 0
      if (cur && first.get(c) === mo) adds++
      if (!cur && prev) losses++
    }
    return { month: mo, adds, losses, net: adds - losses }
  })
}

/** Calendar-month revenue index (Jan..Dec) vs the annual mean. null under 24 months (needs 2 full years). */
export function seasonalityIndex(m: Matrix): { calMonth: string; index: number }[] | null {
  if (m.months.length < 24) return null
  const byCal = new Map<string, number[]>() // 'MM' -> monthly totals
  for (const mo of m.months) {
    const cal = mo.slice(5)
    let total = 0
    for (const c of m.customers) total += get(m, c, mo)
    byCal.set(cal, [...(byCal.get(cal) ?? []), total])
  }
  const avgByCal = new Map<string, number>()
  for (const [cal, vals] of byCal) avgByCal.set(cal, vals.reduce((a, b) => a + b, 0) / vals.length)
  const grand = [...avgByCal.values()].reduce((a, b) => a + b, 0) / avgByCal.size
  if (!grand) return null
  return [...avgByCal.entries()].sort().map(([calMonth, v]) => ({ calMonth, index: (v / grand) * 100 }))
}

function txMonths(txs: Transaction[]): string[] {
  if (!txs.length) return []
  const sorted = txs.map((t) => t.month).sort()
  return monthRange(sorted[0], sorted[sorted.length - 1])
}

/** Per-month base-currency revenue by native currency (for a composition trend). */
export function currencyMixSeries(txs: Transaction[]): { currencies: string[]; rows: Record<string, string | number>[] } {
  const currencies = [...new Set(txs.map((t) => t.currency ?? 'Unknown'))].sort()
  const months = txMonths(txs)
  const rows: Record<string, string | number>[] = months.map((mo) => {
    const row: Record<string, string | number> = { month: mo }
    for (const c of currencies) row[c] = 0
    return row
  })
  const idx = new Map(months.map((mo, i) => [mo, i]))
  for (const t of txs) {
    const i = idx.get(t.month)
    if (i == null) continue
    const key = t.currency ?? 'Unknown'
    rows[i][key] = (rows[i][key] as number) + t.amountBase
  }
  return { currencies, rows }
}

/** New markets entered per month = countries whose first-ever payment is that month. */
export function newMarketEntrySeries(txs: Transaction[]): { month: string; newMarkets: number }[] {
  const firstByCountry = new Map<string, string>()
  for (const t of txs) {
    const country = t.country ?? 'Unknown'
    const cur = firstByCountry.get(country)
    if (!cur || t.month < cur) firstByCountry.set(country, t.month)
  }
  const counts = new Map<string, number>()
  for (const mo of firstByCountry.values()) counts.set(mo, (counts.get(mo) ?? 0) + 1)
  return txMonths(txs).map((mo) => ({ month: mo, newMarkets: counts.get(mo) ?? 0 }))
}
