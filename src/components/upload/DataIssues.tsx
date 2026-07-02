'use client'
import type { DataIssue } from '@/src/lib/normalize'

export function DataIssues({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return null
  return (
    <details className="border-l-2 border-warn bg-paper p-3 text-sm">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] text-warn">{issues.length} rows skipped — data issues</summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
        {issues.slice(0, 100).map((i, k) => <li key={k} className="text-ink-soft">Row {i.rowIndex + 1}: {i.reason}</li>)}
      </ul>
    </details>
  )
}
