import { sampleTransactions } from '@/src/lib/sampleData'
import { DEFAULT_CONTROLS, addMonths } from '@/src/lib/types'
import {
  buildMatrix, mrrOf, arr, arpa, nrr, grr, logoChurnRate, quickRatio, cmgr, activeCustomers,
  movementSeries, movementEvents, cohorts, mrrForecast, ltvRevenue, get,
} from '@/src/lib/engine'
import { computeAlerts } from '@/src/lib/alerts'
import { scoreAccounts, groupByCustomer } from '@/src/lib/signals'
import { marketStats, atlasKey, geoOf, currencyExposure } from '@/src/lib/geo'
import { dailyCollections, dayKey, requiredGrowth } from '@/src/lib/planning'
import { planLedger, planRank, detectPriceChanges, planFlows } from '@/src/lib/pricing'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'

/**
 * Everything the landing page shows, computed from the bundled sample dataset.
 * Runs on the server at build time (the page is static), so none of this ships to the browser.
 */
export function landingData() {
  const txs = sampleTransactions()
  const c = DEFAULT_CONTROLS
  const m = buildMatrix(txs, c.mode)
  const months = m.months
  const last = months[months.length - 1], prev = months[months.length - 2], yearAgo = months[Math.max(0, months.length - 13)]
  const moves = movementSeries(m, { reactivationGapK: c.reactivationGapK })
  const mrr = mrrOf(m, last), pMrr = mrrOf(m, prev)
  const churn = logoChurnRate(m, prev, last) ?? 0
  const a = arpa(m, last) ?? 0
  const asOf = new Date(Math.max(...txs.map((t) => t.date.getTime())))

  // ── headline metrics (ticker) ─────────────────────────────────────────────
  const metrics = [
    ['MRR', fmtMoney(mrr)], ['ARR', fmtMoneyShort(arr(m, last))], ['MoM growth', fmtPct((mrr - pMrr) / pMrr)],
    ['NRR · 12 mo', fmtPct(nrr(m, yearAgo, last))], ['GRR · 12 mo', fmtPct(grr(m, yearAgo, last))],
    ['Quick ratio', (quickRatio(moves.slice(-6)) ?? 0).toFixed(2)], ['Logo churn', fmtPct(churn)],
    ['ARPA', fmtMoney(a)], ['CMGR', fmtPct(cmgr(m))], ['Active customers', String(activeCustomers(m, last))],
    ['LTV', fmtMoneyShort(ltvRevenue(a, c.grossMargin, churn || 0.02))], ['Net new MRR', fmtMoney(moves[moves.length - 1]?.netNew ?? 0)],
  ] as [string, string][]

  // ── 12-month MRR bridge ───────────────────────────────────────────────────
  const yr = moves.slice(-12)
  const sum = (k: 'newMrr' | 'expansion' | 'reactivation' | 'contraction' | 'churn') => yr.reduce((s, x) => s + x[k], 0)
  const bridge = { open: mrrOf(m, yr[0]?.prevMonth ?? months[0]), newMrr: sum('newMrr'), expansion: sum('expansion'), reactivation: sum('reactivation'), contraction: sum('contraction'), churn: sum('churn'), close: mrr }

  // ── cohorts: last 7 cohorts × first 7 months of net retention ─────────────
  const cohortGrid = cohorts(m).filter((x) => x.size >= 2).slice(-10, -3).map((x) => ({ month: x.cohortMonth, size: x.size, nrr: x.netRetention.slice(0, 7) }))

  // ── forecast cone ─────────────────────────────────────────────────────────
  const forecast = { history: months.slice(-12).map((mo) => mrrOf(m, mo)), cone: mrrForecast(m, 6, 6) }

  // ── account signals ───────────────────────────────────────────────────────
  const by = groupByCustomer(txs)
  const scores = scoreAccounts(m, by, months.length - 1, asOf)
  const top = (k: 'churn' | 'expansion') => [...scores].sort((x, y) => y[k] - x[k]).slice(0, 3).map((s) => ({
    name: s.name, mrr: s.mrr, score: s[k], reason: (k === 'churn' ? s.churnSignals : s.expansionSignals)[0]?.reason ?? '', spark: s.spark,
  }))

  // ── account 360: the biggest account ──────────────────────────────────────
  const biggest = [...m.customers].sort((x, y) => get(m, y, last) - get(m, x, last))[0]
  const bigTx = txs.find((t) => t.customerId === biggest)!
  const account = {
    name: bigTx.name ?? biggest, plan: bigTx.plan, country: bigTx.country, mrr: get(m, biggest, last),
    lifetime: (by.get(biggest) ?? []).reduce((s, t) => s + t.amountBase, 0),
    spark: months.map((mo) => get(m, biggest, mo)),
    events: movementEvents(m, txs, c.reactivationGapK).filter((e) => e.customerId === biggest).slice(0, 3),
  }

  // ── markets ───────────────────────────────────────────────────────────────
  const markets = marketStats(txs, 'country', c.mode).rows.filter((r) => r.mrr > 0)
  const maxShare = Math.max(...markets.map((r) => r.share))
  const map = markets.map((r) => ({ key: atlasKey(r.key), label: r.key, t: r.share / maxShare, title: `${r.key}: ${fmtMoney(r.mrr)} MRR · ${fmtPct(r.share)}`, dot: geoOf(r.key) }))
  const fx = currencyExposure(txs, last)

  // ── cash calendar: last 18 weeks ──────────────────────────────────────────
  const daily = dailyCollections(txs)
  const end = new Date(asOf); end.setHours(0, 0, 0, 0)
  const start = new Date(end); start.setDate(start.getDate() - 18 * 7 + 1); start.setDate(start.getDate() - start.getDay())
  const cash: { x: number; y: number; v: number }[] = []
  for (let i = 0, d = new Date(start); d <= end; i++, d.setDate(d.getDate() + 1)) cash.push({ x: Math.floor(i / 7), y: d.getDay(), v: daily.get(dayKey(d)) ?? 0 })
  const cashMax = Math.max(1, ...cash.map((x) => x.v))

  // ── pricing ───────────────────────────────────────────────────────────────
  const ledger = planLedger(txs)
  const rank = planRank(ledger)
  const priceEvents = detectPriceChanges(ledger, months)
  // existing accounts only — new signups would swamp the plan-to-plan moves in a small card
  const flows = planFlows(ledger, yearAgo, last, rank).filter((f) => f.kind !== 'new')
  const plans = [...rank.keys()].reverse()

  // ── goals: 2× ARR in 12 months ────────────────────────────────────────────
  const curArr = mrr * 12, target = Math.round((curArr * 2) / 100000) * 100000
  const base6 = months[months.length - 7]
  const goal = { curArr, target, need: requiredGrowth(curArr, target, 12), pace: requiredGrowth(mrrOf(m, base6), mrr, 6) }

  const alerts = computeAlerts(txs, c, null).filter((x) => x.severity !== 'good').slice(0, 4)

  return {
    last, metrics, bridge, cohortGrid, forecast, churnTop: top('churn'), expansionTop: top('expansion'), account,
    markets: markets.slice(0, 5), marketCount: markets.length, map, fx, cash, cashMax, priceEvents, flows, plans, goal, alerts,
    update: { month: last, mrr, pMrr, prevMonth: prev, newLogos: yr.length ? moves[moves.length - 1].newMrr : 0 },
    since: addMonths(last, -12),
  }
}

export type LandingData = ReturnType<typeof landingData>
