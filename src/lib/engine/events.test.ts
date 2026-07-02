import { describe, it, expect } from 'vitest'
import type { Transaction } from '../types'
import { monthKey } from '../types'
import { buildMatrix } from './matrix'
import { movementEvents } from './events'
import { paretoCurve } from './segments'

let pid = 0
function tx(customerId: string, month: string, amountBase: number): Transaction {
  const date = new Date(`${month}-15T00:00:00Z`)
  return {
    paymentId: `P${pid++}`, invoiceNumber: null, date, month: monthKey(date), customerId,
    name: customerId === 'A' ? 'Acme' : 'Beta', country: 'United States', region: 'NA',
    businessModel: 'SMB', currency: 'USD', amountNative: amountBase, amountBase, isRefund: false,
  }
}

// A: new(01) -> expansion(02:+50) -> contraction(03:-30) -> churn(04) -> reactivation(06:+80)
// B: new(02:+200)
const txs = [
  tx('A', '2025-01', 100), tx('A', '2025-02', 150), tx('A', '2025-03', 120), tx('A', '2025-06', 80),
  tx('B', '2025-02', 200),
]

describe('movementEvents', () => {
  const ev = movementEvents(buildMatrix(txs, 'activity'), txs, 1)
  const find = (type: string, month: string, cust: string) =>
    ev.find((e) => e.type === type && e.month === month && e.customerId === cust)

  it('detects a new logo', () => expect(find('new', '2025-02', 'B')?.amount).toBe(200))
  it('detects expansion', () => expect(find('expansion', '2025-02', 'A')?.amount).toBe(50))
  it('detects contraction as negative', () => expect(find('contraction', '2025-03', 'A')?.amount).toBe(-30))
  it('detects churn as negative prior MRR', () => expect(find('churn', '2025-04', 'A')?.amount).toBe(-120))
  it('detects reactivation after a gap', () => expect(find('reactivation', '2025-06', 'A')?.amount).toBe(80))
  it('is sorted newest-first', () => expect(ev[0].month).toBe('2025-06'))
})

describe('paretoCurve', () => {
  const pts = paretoCurve(txs)
  it('starts at origin and ends at (1,1)', () => {
    expect(pts[0]).toEqual({ x: 0, y: 0 })
    const lastPt = pts[pts.length - 1]
    expect(lastPt.x).toBeCloseTo(1)
    expect(lastPt.y).toBeCloseTo(1)
  })
  it('is monotonically non-decreasing in y', () => {
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y)
  })
})
