import { describe, it, expect } from 'vitest'
import { applyFilters, dimensionValues, overviewModel } from './dashboard'
import { scenario } from './testdata'

describe('applyFilters', () => {
  const txs = scenario()
  it('filters by region', () => {
    const r = applyFilters(txs, { regions: ['EU'], businessModels: [], currencies: [] }, { start: null, end: null })
    expect(r.every((t) => t.region === 'EU')).toBe(true)
    expect(r).toHaveLength(2) // c3 has 2 rows
  })
  it('filters by month range inclusive', () => {
    const r = applyFilters(txs, { regions: [], businessModels: [], currencies: [] }, { start: '2026-02', end: '2026-03' })
    expect(r.every((t) => t.month >= '2026-02')).toBe(true)
    expect(r.some((t) => t.month === '2026-01')).toBe(false)
  })
  it('empty filters return all rows', () => {
    expect(applyFilters(txs, { regions: [], businessModels: [], currencies: [] }, { start: null, end: null })).toHaveLength(txs.length)
  })
})

describe('dimensionValues', () => {
  it('lists distinct sorted values for a dimension', () => {
    expect(dimensionValues(scenario(), 'region')).toEqual(['EU', 'NA'])
  })
})

describe('overviewModel', () => {
  it('produces the latest-month headline KPIs', () => {
    const model = overviewModel(scenario(), { mode: 'activity', includeRefunds: true, reactivationGapK: 1, dormancyDays: 90, atRiskStreak: 3, grossMargin: 0.8 })
    expect(model.month).toBe('2026-03')
    expect(model.mrr).toBe(600) // 150 + 200 + 250
    expect(model.arr).toBe(7200)
    expect(model.activeCustomers).toBe(3)
  })
})
