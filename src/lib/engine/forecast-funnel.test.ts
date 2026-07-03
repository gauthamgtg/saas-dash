import { describe, it, expect } from 'vitest'
import type { Transaction } from '../types'
import { monthKey } from '../types'
import { buildMatrix } from './matrix'
import { mrrForecast } from './forecast'
import { conversionFunnel } from './funnel'

let pid = 0
function tx(customerId: string, month: string, amountBase: number): Transaction {
  const date = new Date(`${month}-15T00:00:00Z`)
  return {
    paymentId: `P${pid++}`, invoiceNumber: null, date, month: monthKey(date), customerId,
    name: customerId, country: 'US', region: 'NA', businessModel: 'SMB', currency: 'USD',
    amountNative: amountBase, amountBase, isRefund: false,
  }
}

describe('mrrForecast', () => {
  // one customer growing ~10%/month for 7 months
  const vals = [100, 110, 121, 133, 146, 161, 177]
  const txs = vals.map((v, i) => tx('A', `2025-0${i + 1}`, v))
  const fc = mrrForecast(buildMatrix(txs, 'activity'), 3, 6)

  it('projects the trailing growth rate forward', () => {
    expect(fc).toHaveLength(3)
    expect(fc[0].projected).toBeGreaterThan(177)
  })
  it('is monotincreasing and cone brackets the projection', () => {
    for (let i = 1; i < fc.length; i++) expect(fc[i].projected).toBeGreaterThan(fc[i - 1].projected)
    for (const p of fc) { expect(p.lo).toBeLessThan(p.projected); expect(p.hi).toBeGreaterThan(p.projected) }
  })
  it('returns [] without positive history', () => {
    expect(mrrForecast(buildMatrix([tx('A', '2025-01', 100)], 'activity'), 3)).toEqual([])
  })
})

describe('conversionFunnel', () => {
  // A: 4 payments, grows (expanded) · B: 2 payments (repeat) · C: 1 payment
  const txs = [
    tx('A', '2025-01', 100), tx('A', '2025-02', 150), tx('A', '2025-03', 120), tx('A', '2025-04', 130),
    tx('B', '2025-01', 200), tx('B', '2025-02', 200),
    tx('C', '2025-01', 50),
  ]
  const f = conversionFunnel(buildMatrix(txs, 'activity'), txs)

  it('is a nested, monotonically non-increasing funnel', () => {
    expect(f.map((s) => s.count)).toEqual([3, 2, 1, 1])
    for (let i = 1; i < f.length; i++) expect(f[i].count).toBeLessThanOrEqual(f[i - 1].count)
  })
  it('reports share of the top of funnel', () => {
    expect(f[0].pct).toBe(1)
    expect(f[1].pct).toBeCloseTo(2 / 3)
  })
})
