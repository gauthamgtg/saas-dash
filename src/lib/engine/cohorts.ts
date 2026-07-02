import type { Matrix } from '../types'
import { get } from './matrix'
import { addMonths, monthDiff } from '../types'

export type Cohort = {
  cohortMonth: string
  size: number
  netRetention: number[] // index = age in months; [0] = 1
  grossRetention: number[]
  logoSurvival: number[]
}

function firstActiveMonth(m: Matrix, c: string): string | null {
  for (const mo of m.months) if (get(m, c, mo) !== 0) return mo
  return null
}

export function cohorts(m: Matrix): Cohort[] {
  const groups = new Map<string, string[]>() // cohortMonth -> customerIds
  for (const c of m.customers) {
    const f = firstActiveMonth(m, c)
    if (!f) continue
    const g = groups.get(f) ?? []
    g.push(c)
    groups.set(f, g)
  }
  const lastMonth = m.months[m.months.length - 1]
  const out: Cohort[] = []
  for (const [cohortMonth, members] of [...groups].sort((a, b) => monthDiff(b[0], a[0]))) { // chronological
    const maxAge = monthDiff(cohortMonth, lastMonth)
    const base = members.reduce((s, c) => s + get(m, c, cohortMonth), 0)
    const netRetention: number[] = []
    const grossRetention: number[] = []
    const logoSurvival: number[] = []
    for (let age = 0; age <= maxAge; age++) {
      const mo = addMonths(cohortMonth, age)
      let net = 0, gross = 0, active = 0
      for (const c of members) {
        const v = get(m, c, mo)
        net += v
        gross += Math.min(v, get(m, c, cohortMonth))
        if (v !== 0) active++
      }
      netRetention.push(base ? net / base : 0)
      grossRetention.push(base ? gross / base : 0)
      logoSurvival.push(members.length ? active / members.length : 0)
    }
    out.push({ cohortMonth, size: members.length, netRetention, grossRetention, logoSurvival })
  }
  return out
}
