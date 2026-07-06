import type { DataIssue } from './normalize'

export type IssueGroup = { category: string; hint: string; count: number; examples: string[] }

function categorize(reason: string): { category: string; hint: string } {
  if (reason.startsWith('Unparseable date')) return { category: 'Dates', hint: 'Try a different date format below' }
  if (reason.startsWith('Non-numeric amount')) return { category: 'Amounts', hint: 'Check the mapped revenue column' }
  if (reason.startsWith('Unknown currency')) return { category: 'Currency', hint: 'Add an FX rate for this currency' }
  return { category: 'Other', hint: '' }
}

/** Group raw issues by category with counts + a few example values (for the validation UI). */
export function summarizeIssues(issues: DataIssue[]): IssueGroup[] {
  const map = new Map<string, { hint: string; count: number; examples: Set<string> }>()
  for (const it of issues) {
    const { category, hint } = categorize(it.reason)
    const g = map.get(category) ?? { hint, count: 0, examples: new Set<string>() }
    g.count++
    const val = it.reason.match(/"([^"]*)"/)?.[1]
    if (val && g.examples.size < 5) g.examples.add(val)
    map.set(category, g)
  }
  return [...map.entries()]
    .map(([category, g]) => ({ category, hint: g.hint, count: g.count, examples: [...g.examples] }))
    .sort((a, b) => b.count - a.count)
}
