'use client'
import type { DataIssue } from '@/src/lib/normalize'

export function DataIssues({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return null
  return (
    <details className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-800">{issues.length} rows skipped (data issues)</summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
        {issues.slice(0, 100).map((i, k) => <li key={k} className="text-amber-900">Row {i.rowIndex + 1}: {i.reason}</li>)}
      </ul>
    </details>
  )
}
