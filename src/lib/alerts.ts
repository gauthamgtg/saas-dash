import type { Transaction, Controls } from './types'
import type { SpendRow } from './spend'
import { addMonths } from './types'
import {
  buildMatrix, mrrOf, nrr, logoChurnRate, movementSeries, quickRatio,
  topNShare, hhi, arpa, grr, ltvRevenue, cacSeries, blendedCac, atRisk,
} from './engine'
import { revenueWeightedChurn } from './engine/investor'
import { growthPersistence, netNegativeChurn, concentrationRisk } from './engine/rates'
import { burnMultiple } from './engine/burn'
import { fmtMoney, fmtPct } from './format'

export type AlertSeverity = 'critical' | 'warn' | 'info' | 'good'
export type Alert = {
  id: string
  severity: AlertSeverity
  title: string
  detail: string
  view?: 'growth' | 'customers' | 'health' | 'segments' | 'unitecon' | 'cohorts' | 'board' | 'mrr' | 'forecast'
}

/** Rule-based health checks for founders, analysts, and board reviews. */
export function computeAlerts(
  txs: Transaction[],
  controls: Controls,
  spend: SpendRow[] | null,
): Alert[] {
  const out: Alert[] = []
  if (!txs.length) return out
  const m = buildMatrix(txs, controls.mode)
  if (!m.months.length) return out
  const last = m.months[m.months.length - 1]
  const prev = m.months.length > 1 ? m.months[m.months.length - 2] : addMonths(last, -1)
  const series = movementSeries(m, { reactivationGapK: controls.reactivationGapK })

  const momNrr = nrr(m, prev, last)
  if (momNrr != null && momNrr < 0.9) {
    out.push({
      id: 'nrr-dip', severity: 'critical', view: 'growth',
      title: 'NRR below 90%',
      detail: `MoM net revenue retention is ${fmtPct(momNrr)}. Existing customers are shrinking the base.`,
    })
  } else if (momNrr != null && momNrr < 1) {
    out.push({
      id: 'nrr-soft', severity: 'warn', view: 'growth',
      title: 'NRR under 100%',
      detail: `MoM NRR ${fmtPct(momNrr)} — base is slowly contracting.`,
    })
  } else if (netNegativeChurn(m, prev, last)) {
    out.push({
      id: 'nnc', severity: 'good', view: 'growth',
      title: 'Net-negative churn',
      detail: `NRR ${fmtPct(momNrr)} — expansion more than offsets churn.`,
    })
  }

  const churn = logoChurnRate(m, prev, last)
  if (churn != null && churn > 0.05) {
    out.push({
      id: 'logo-churn', severity: churn > 0.08 ? 'critical' : 'warn', view: 'customers',
      title: 'Elevated logo churn',
      detail: `${fmtPct(churn)} of active logos churned last month.`,
    })
  }

  const rw = revenueWeightedChurn(m, prev, last)
  if (rw != null && churn != null && rw > churn * 1.5 && rw > 0.03) {
    out.push({
      id: 'whale-churn', severity: 'critical', view: 'customers',
      title: 'Revenue-weighted churn >> logo churn',
      detail: `Revenue-weighted ${fmtPct(rw)} vs logo ${fmtPct(churn)} — larger accounts are leaving.`,
    })
  }

  const qr = quickRatio(series.slice(-3))
  if (qr != null && qr < 1) {
    out.push({
      id: 'qr-low', severity: 'warn', view: 'growth',
      title: 'Quick ratio under 1',
      detail: `Trailing 3-mo quick ratio ${qr.toFixed(2)} — outflow exceeds inflow.`,
    })
  } else if (qr != null && qr >= 4) {
    out.push({
      id: 'qr-strong', severity: 'good', view: 'growth',
      title: 'Strong quick ratio',
      detail: `Trailing 3-mo quick ratio ${qr.toFixed(2)}.`,
    })
  }

  // HHI is 0..10000 in this codebase
  const risk = concentrationRisk(topNShare(txs, 5), hhi(txs) / 10000)
  if (risk.flagged) {
    out.push({
      id: 'concentration', severity: 'warn', view: 'segments',
      title: 'Customer concentration risk',
      detail: risk.reason ?? 'Revenue is concentrated in few accounts.',
    })
  }

  const atRiskList = m.customers.filter((c) => atRisk(m, c, controls.atRiskStreak))
  if (atRiskList.length) {
    out.push({
      id: 'at-risk', severity: atRiskList.length >= 5 ? 'critical' : 'warn', view: 'health',
      title: `${atRiskList.length} account${atRiskList.length === 1 ? '' : 's'} at risk`,
      detail: `Decline streak ≥ ${controls.atRiskStreak} months. Review in Customer Health.`,
    })
  }

  const persist = growthPersistence(m, 12)
  if (persist != null && persist < 0.5 && m.months.length >= 6) {
    out.push({
      id: 'persist', severity: 'info', view: 'mrr',
      title: 'Lumpy growth',
      detail: `Only ${fmtPct(persist)} of recent months showed MoM gains.`,
    })
  }

  const cur = mrrOf(m, last), prevMrr = mrrOf(m, prev)
  if (prevMrr > 0 && (cur - prevMrr) / prevMrr < -0.05) {
    out.push({
      id: 'mrr-drop', severity: 'critical', view: 'mrr',
      title: 'MRR dropped >5% MoM',
      detail: `${fmtMoney(prevMrr)} → ${fmtMoney(cur)}.`,
    })
  }

  if (spend?.length) {
    const bm = burnMultiple(m, spend)
    if (bm != null && Number.isFinite(bm) && bm > 2) {
      out.push({
        id: 'burn-mult', severity: bm > 3 ? 'critical' : 'warn', view: 'unitecon',
        title: 'High burn multiple',
        detail: `Burn multiple ≈ ${bm.toFixed(1)}× — efficiency is below efficient-growth norms.`,
      })
    }
    const seriesCac = cacSeries(m, spend)
    const cac = blendedCac(seriesCac)
    const a = arpa(m, last)
    const vals: number[] = []
    for (let i = Math.max(1, m.months.length - 12); i < m.months.length; i++) {
      const r = grr(m, m.months[i - 1], m.months[i])
      if (r != null) vals.push(1 - r)
    }
    const churnMonthly = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
    const ltv = a != null && churnMonthly != null ? ltvRevenue(a, controls.grossMargin, churnMonthly) : null
    if (cac != null && ltv != null && ltv / cac < 3) {
      out.push({
        id: 'ltv-cac', severity: 'warn', view: 'unitecon',
        title: 'LTV:CAC under 3×',
        detail: `LTV ${fmtMoney(ltv)} vs CAC ${fmtMoney(cac)} (${(ltv / cac).toFixed(1)}×).`,
      })
    }
  } else {
    out.push({
      id: 'no-spend', severity: 'info', view: 'unitecon',
      title: 'Upload spend for unit economics',
      detail: 'CAC, LTV:CAC, Magic Number, Rule of 40, and burn multiple need a spend CSV.',
    })
  }

  return out.sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function severityRank(s: AlertSeverity): number {
  return { critical: 0, warn: 1, info: 2, good: 3 }[s]
}
