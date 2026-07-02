import type { Transaction, Controls } from './types'
import { addMonths } from './types'
import {
  buildMatrix, mrrOf, movementSeries, nrr, logoChurnRate,
  revenueByDimension, topNShare, hhi, dominantCurrencyShare, movementEvents,
} from './engine'
import { fmtMoney, fmtPct } from './format'

export type Insight = { icon: string; text: string; tone: 'pos' | 'neg' | 'neutral' }

/** Auto-generated plain-English observations, mirroring the "Insights" panel of the reference dashboards. */
export function insights(txs: Transaction[], controls: Controls): Insight[] {
  const out: Insight[] = []
  if (!txs.length) return out
  const m = buildMatrix(txs, controls.mode)
  const months = m.months
  if (!months.length) return out
  const last = months[months.length - 1]
  const prev = months.length > 1 ? months[months.length - 2] : addMonths(last, -1)

  const curMrr = mrrOf(m, last), prevMrr = mrrOf(m, prev)
  if (prevMrr > 0) {
    const g = (curMrr - prevMrr) / prevMrr
    out.push({
      icon: g >= 0 ? 'trend-up' : 'trend-down', tone: g >= 0 ? 'pos' : 'neg',
      text: `MRR ${g >= 0 ? 'grew' : 'fell'} ${fmtPct(Math.abs(g))} to ${fmtMoney(curMrr)} vs ${prev}.`,
    })
  }

  const models = revenueByDimension(txs, 'businessModel')
  if (models.length) out.push({
    icon: 'award', tone: 'neutral',
    text: `${models[0].key} is your top segment at ${fmtPct(models[0].share, 0)} of revenue.`,
  })

  const r = nrr(m, prev, last)
  if (r != null) out.push({
    icon: r >= 1 ? 'shield-check' : 'shield', tone: r >= 1 ? 'pos' : 'neg',
    text: `Net revenue retention is ${fmtPct(r)} — ${r >= 1 ? 'the base is expanding on its own.' : 'the existing base is contracting.'}`,
  })

  const churn = logoChurnRate(m, prev, last)
  if (churn != null && churn > 0) out.push({
    icon: 'alert', tone: churn > 0.05 ? 'neg' : 'neutral',
    text: `Logo churn ran ${fmtPct(churn)} last month.`,
  })

  const top5 = topNShare(txs, 5)
  if (top5 > 0.4) out.push({
    icon: 'target', tone: 'neg',
    text: `Concentration risk: top 5 customers are ${fmtPct(top5)} of revenue (HHI ${Math.round(hhi(txs)).toLocaleString()}).`,
  })

  const ev = movementEvents(m, txs, controls.reactivationGapK).filter((e) => e.month === last)
  const biggestWin = ev.filter((e) => e.type === 'new' || e.type === 'expansion' || e.type === 'reactivation').sort((a, b) => b.amount - a.amount)[0]
  const biggestLoss = ev.filter((e) => e.type === 'churn' || e.type === 'contraction').sort((a, b) => a.amount - b.amount)[0]
  if (biggestWin) out.push({
    icon: 'sparkle', tone: 'pos',
    text: `Biggest gain this month: ${biggestWin.name ?? biggestWin.customerId} (+${fmtMoney(biggestWin.amount)} ${biggestWin.type}).`,
  })
  if (biggestLoss) out.push({
    icon: 'trend-down', tone: 'neg',
    text: `Biggest loss this month: ${biggestLoss.name ?? biggestLoss.customerId} (${fmtMoney(biggestLoss.amount)} ${biggestLoss.type}).`,
  })

  const fx = dominantCurrencyShare(txs)
  if (fx < 0.85) out.push({
    icon: 'globe', tone: 'neutral',
    text: `Currency exposure: largest currency is only ${fmtPct(fx, 0)} of revenue — meaningful FX spread.`,
  })

  return out.slice(0, 6)
}
