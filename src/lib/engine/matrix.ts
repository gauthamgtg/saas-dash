import type { Matrix, MrrMode, Transaction } from '../types'
import { addMonths, monthDiff, monthKey, monthRange } from '../types'

export function get(m: Matrix, customer: string, month: string): number {
  return m.cells.get(customer)?.get(month) ?? 0
}

function set(cells: Map<string, Map<string, number>>, c: string, month: string, v: number) {
  let row = cells.get(c)
  if (!row) cells.set(c, (row = new Map()))
  row.set(month, (row.get(month) ?? 0) + v)
}

/** Median gap in months between a customer's sorted distinct payment months. */
function inferTermMonths(months: string[]): number {
  if (months.length < 2) return 1 // single payment => one-time (span of 1)
  const gaps: number[] = []
  for (let i = 1; i < months.length; i++) gaps.push(monthDiff(months[i - 1], months[i]))
  gaps.sort((a, b) => a - b)
  const med = gaps[Math.floor(gaps.length / 2)]
  if (med <= 1.5) return 1
  if (med <= 4) return 3
  return 12 // annual/lump
}

export function buildMatrix(transactions: Transaction[], mode: MrrMode, range?: [string, string]): Matrix {
  const cells = new Map<string, Map<string, number>>()
  if (transactions.length === 0) {
    return { cells, months: [], customers: [], mode }
  }
  let min = transactions[0].month
  let max = transactions[0].month
  for (const t of transactions) {
    if (monthDiff(t.month, min) > 0) min = t.month
    if (monthDiff(max, t.month) > 0) max = t.month
  }
  if (range) { min = range[0]; max = range[1] }

  if (mode === 'activity') {
    for (const t of transactions) set(cells, t.customerId, t.month, t.amountBase)
  } else {
    // subscription: group by customer, infer term from active months, amortize each payment forward
    const byCust = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const arr = byCust.get(t.customerId) ?? []
      arr.push(t)
      byCust.set(t.customerId, arr)
    }
    for (const [cust, txs] of byCust) {
      const activeMonths = [...new Set(txs.map((t) => t.month))].sort()
      const term = inferTermMonths(activeMonths)
      for (const t of txs) {
        const per = t.amountBase / term
        for (let k = 0; k < term; k++) set(cells, cust, addMonths(t.month, k), per)
      }
    }
  }

  const months = monthRange(min, max)
  const customers = [...cells.keys()]
  return { cells, months, customers, mode }
}

export function mrrOf(m: Matrix, month: string): number {
  let sum = 0
  for (const c of m.customers) sum += get(m, c, month)
  return sum
}

export function activeCustomers(m: Matrix, month: string): number {
  let n = 0
  for (const c of m.customers) if (get(m, c, month) !== 0) n++
  return n
}
