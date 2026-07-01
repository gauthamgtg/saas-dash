import { describe, it, expect } from 'vitest'
import { buildMatrix, mrrOf } from './matrix'
import { movementSeries } from './movement'
import { scenario } from '../testdata'

describe('movementSeries', () => {
  const m = buildMatrix(scenario(), 'activity')
  const series = movementSeries(m, { reactivationGapK: 1 })
  const feb = series.find((s) => s.month === '2026-02')!
  const mar = series.find((s) => s.month === '2026-03')!

  it('classifies Feb: c1 expansion +50, c2 churn -200, c3 new +300', () => {
    expect(feb.expansion).toBe(50)
    expect(feb.churn).toBe(200)
    expect(feb.newMrr).toBe(300)
    expect(feb.reactivation).toBe(0)
    expect(feb.contraction).toBe(0)
  })
  it('classifies Mar: c2 reactivation +200, c3 contraction -50', () => {
    expect(mar.reactivation).toBe(200)
    expect(mar.contraction).toBe(50)
    expect(mar.newMrr).toBe(0)
  })
  it('satisfies the bridge identity every month', () => {
    for (const s of series) {
      const prev = mrrOf(m, s.month === '2026-01' ? '2026-01' : s.prevMonth!)
      const expected = mrrOf(m, s.month)
      const bridge = prev + s.newMrr + s.expansion + s.reactivation - s.contraction - s.churn
      expect(bridge).toBeCloseTo(expected)
    }
  })
})
