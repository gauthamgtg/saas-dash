import type { DataIssue } from '@/src/lib/normalize'
import { summarizeIssues } from '@/src/lib/issues'

const tint = (c: string) => `color-mix(in srgb, ${c} 13%, transparent)`

/** Grouped, human-readable breakdown of why rows were skipped. */
export function IssueSummary({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return null
  const groups = summarizeIssues(issues)
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.category} className="rounded-lg border border-line bg-paper p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-ink">{g.category}</span>
            <span className="rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-warn" style={{ background: tint('var(--warn)') }}>{g.count.toLocaleString()} rows</span>
          </div>
          {g.hint && <p className="mt-0.5 text-[11px] text-ink-soft">{g.hint}</p>}
          {g.examples.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {g.examples.map((ex) => <code key={ex} className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">{ex || '(empty)'}</code>)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
