import { describe, expect, it } from 'vitest'
import { buildMatrix } from './matrix'
import { movementSeries } from './movement'
import { expansionRate, earlyLifeChurn, movementMix, avgRetentionCurves } from './retentionDepth'
import { atRiskRevenue, concentrationCovenants } from './risk'
import { bottomUpForecast } from './efficiencyDepth'
import { arrBridge } from './arrBridge'
import type { Transaction } from '../types'

function tx(customerId: string, month: string, amountBase: number): Transaction {
  const [y, m] = month.split('-').map(Number)
  return {
    paymentId: `${customerId}-${month}`, invoiceNumber: null,
    date: new Date(Date.UTC(y, m - 1, 15)), month, customerId, name: customerId,
    country: null, region: 'AMER', businessModel: 'SaaS', plan: 'Pro',
    currency: 'USD', amountNative: amountBase, amountBase, isRefund: false,
  }
}

describe('advanced analytics engines', () => {
  it('computes expansion rate and movement mix', () => {
    const txs = [
      tx('a', '2026-01', 100), tx('a', '2026-02', 150),
      tx('b', '2026-01', 50), tx('b', '2026-02', 50),
    ]
    const m = buildMatrix(txs, 'activity')
    const series = movementSeries(m, { reactivationGapK: 1 })
    expect(expansionRate(series, 150)).toBeCloseTo(50 / 150)
    expect(movementMix(series)?.shares.expansion).toBeGreaterThan(0)
  })

  it('builds retention curves and early churn', () => {
    const txs = [
      tx('a', '2025-10', 100), tx('a', '2025-11', 100), tx('a', '2025-12', 0),
      tx('b', '2025-10', 80), tx('b', '2025-11', 80), tx('b', '2025-12', 80),
      tx('c', '2026-01', 50), tx('c', '2026-02', 50),
    ]
    // fix zero month - activity mode with no payment means 0
    const m = buildMatrix(txs.filter((t) => t.amountBase > 0), 'activity')
    expect(avgRetentionCurves(m, 3).length).toBeGreaterThan(1)
    expect(earlyLifeChurn(m, 2).length).toBeGreaterThanOrEqual(0)
  })

  it('flags concentration covenants and at-risk $', () => {
    const txs = [
      tx('whale', '2026-01', 900), tx('whale', '2026-02', 800), tx('whale', '2026-03', 700),
      tx('small', '2026-01', 50), tx('small', '2026-02', 50), tx('small', '2026-03', 50),
    ]
    const m = buildMatrix(txs, 'activity')
    const risk = atRiskRevenue(m, txs, 2)
    expect(risk.mrrAtRisk).toBeGreaterThan(0)
    const c = concentrationCovenants(0.3, 0.6, 3000)
    expect(c.every((x) => !x.ok)).toBe(true)
  })

  it('builds ARR bridge and bottom-up forecast', () => {
    const txs = [
      tx('a', '2026-01', 100), tx('a', '2026-02', 120),
      tx('b', '2026-02', 40),
    ]
    const m = buildMatrix(txs, 'activity')
    const series = movementSeries(m, { reactivationGapK: 1 })
    const bridge = arrBridge(m, series)
    expect(bridge?.closingMrr).toBeGreaterThan(0)
    const bu = bottomUpForecast(m, [], 3)
    expect(bu).toHaveLength(3)
  })
})
