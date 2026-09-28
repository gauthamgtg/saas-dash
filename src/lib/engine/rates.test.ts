import { describe, expect, it } from 'vitest'
import { buildMatrix } from './matrix'
import type { Transaction } from '../types'
import {
  contractionRate, reactivationRate, growthPersistence, winBackRate,
  netNegativeChurn, scenarioForecast, concentrationRisk,
} from './rates'
import { movementSeries } from './movement'
import { burnMultiple, avgMonthlyNetBurn, runwayMonths } from './burn'
import type { SpendRow } from '../spend'

function tx(partial: Partial<Transaction> & { customerId: string; month: string; amountBase: number }): Transaction {
  const [y, m] = partial.month.split('-').map(Number)
  return {
    paymentId: `${partial.customerId}-${partial.month}`,
    invoiceNumber: null,
    date: new Date(Date.UTC(y, m - 1, 15)),
    name: partial.customerId,
    country: null, region: null, businessModel: null,
    currency: 'USD', amountNative: partial.amountBase,
    isRefund: false,
    ...partial,
  }
}

describe('rates', () => {
  it('computes contraction / reactivation rates from movement', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
      tx({ customerId: 'a', month: '2026-02', amountBase: 80 }),
      tx({ customerId: 'b', month: '2026-01', amountBase: 50 }),
      // b gone in Feb = churn; c returns after gap
      tx({ customerId: 'c', month: '2025-11', amountBase: 40 }),
      tx({ customerId: 'c', month: '2026-02', amountBase: 40 }),
    ]
    const m = buildMatrix(txs, 'activity')
    const series = movementSeries(m, { reactivationGapK: 1 })
    const last = series[series.length - 1]
    expect(contractionRate([last], 150)).toBeCloseTo(20 / 150)
  })

  it('flags net-negative churn when NRR > 1', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
      tx({ customerId: 'a', month: '2026-02', amountBase: 150 }),
    ]
    const m = buildMatrix(txs, 'activity')
    expect(netNegativeChurn(m, '2026-01', '2026-02')).toBe(true)
  })

  it('measures growth persistence', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
      tx({ customerId: 'a', month: '2026-02', amountBase: 110 }),
      tx({ customerId: 'a', month: '2026-03', amountBase: 105 }),
      tx({ customerId: 'a', month: '2026-04', amountBase: 120 }),
    ]
    const m = buildMatrix(txs, 'activity')
    expect(growthPersistence(m, 12)).toBeCloseTo(2 / 3)
  })

  it('tracks win-back rate', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
      tx({ customerId: 'a', month: '2026-03', amountBase: 100 }), // gap in Feb → churn then reactivate
      tx({ customerId: 'b', month: '2026-01', amountBase: 50 }),
      // b never returns
    ]
    const m = buildMatrix(txs, 'activity')
    // a churned then returned; b churned (implicit zero months) — careful: b only in Jan, later months zero
    const rate = winBackRate(m)
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0)
  })

  it('builds scenario forecast paths', () => {
    const rows = scenarioForecast(1000, '2026-01', { bear: -0.01, base: 0.02, bull: 0.05 }, 3)
    expect(rows).toHaveLength(3)
    expect(rows[0].month).toBe('2026-02')
    expect(rows[2].bull).toBeGreaterThan(rows[2].base)
    expect(rows[2].base).toBeGreaterThan(rows[2].bear)
  })

  it('flags concentration risk', () => {
    expect(concentrationRisk(0.5, 0.1).flagged).toBe(true)
    expect(concentrationRisk(0.2, 0.3).flagged).toBe(true)
    expect(concentrationRisk(0.2, 0.1).flagged).toBe(false)
  })
})

describe('burn', () => {
  it('computes burn multiple and runway', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 1000 }),
      tx({ customerId: 'a', month: '2026-02', amountBase: 1200 }),
      tx({ customerId: 'a', month: '2026-03', amountBase: 1500 }),
    ]
    const spend: SpendRow[] = [
      { month: '2026-01', channel: 'Ads', category: 'marketing', amount: 2000 },
      { month: '2026-02', channel: 'Ads', category: 'marketing', amount: 2200 },
      { month: '2026-03', channel: 'Ads', category: 'marketing', amount: 2500 },
      { month: '2026-01', channel: 'Payroll', category: 'other', amount: 3000 },
      { month: '2026-02', channel: 'Payroll', category: 'other', amount: 3000 },
      { month: '2026-03', channel: 'Payroll', category: 'other', amount: 3000 },
    ]
    const m = buildMatrix(txs, 'activity')
    const bm = burnMultiple(m, spend, 3)
    expect(bm).not.toBeNull()
    expect(bm!).toBeGreaterThan(0)
    const burn = avgMonthlyNetBurn(m, spend, 3)
    expect(burn).toBeGreaterThan(0)
    expect(runwayMonths(50_000, burn!)).toBeCloseTo(50_000 / burn!)
  })
})
