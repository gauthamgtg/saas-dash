'use client'
import type { DataIssue } from '@/src/lib/normalize'
import { IssueSummary } from './IssueSummary'

export function DataIssues({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return null
  return (
    <details className="rounded-lg border border-line border-l-2 border-l-warn bg-paper p-3 text-sm shadow-card">
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] text-warn">
        {issues.length.toLocaleString()} rows skipped on import — data issues
      </summary>
      <div className="mt-3"><IssueSummary issues={issues} /></div>
      <p className="mt-2 font-mono text-[10px] text-ink-faint">These rows were excluded from all metrics. Re-upload to adjust the mapping or date format.</p>
    </details>
  )
}
