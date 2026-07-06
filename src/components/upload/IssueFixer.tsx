'use client'
import { useMemo, useState } from 'react'
import type { Issue, BlockingIssue, DuplicateIdIssue, DuplicateRowIssue } from '@/src/lib/normalize'
import { summarizeIssues } from '@/src/lib/issues'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import type { DateOrder } from '@/src/lib/date'

const tint = (c: string) => `color-mix(in srgb, ${c} 13%, transparent)`
const DATE_OPTS: { v: Exclude<DateOrder, 'auto'>; label: string }[] = [
  { v: 'dmy', label: 'DD/MM/YYYY' }, { v: 'mdy', label: 'MM/DD/YYYY' }, { v: 'ymd', label: 'YYYY-MM-DD' },
]

const isDuplicate = (it: Issue): it is DuplicateIdIssue | DuplicateRowIssue => it.kind === 'duplicateId' || it.kind === 'duplicateRow'

function inputType(issue: Issue): 'date' | 'number' | 'text' {
  if (issue.blocking && issue.kind === 'date') return 'date'
  if (issue.blocking && issue.kind === 'amount') return 'number'
  return 'text'
}

function currentRawValue(issue: BlockingIssue, mapping: Mapping): string {
  const col = mapping[issue.field]
  return col ? issue.raw[col] ?? '' : ''
}

export type IssueFixerProps = {
  issues: Issue[]
  mapping: Mapping
  onFix: (ids: string[], patch: Partial<Record<ColumnField, string>>, dateOrder?: Exclude<DateOrder, 'auto'>) => void
  onRemove: (ids: string[]) => void
  onRemoveMember?: (paymentId: string) => void
  onDismiss?: (ids: string[]) => void
}

/** Interactive fix/remove/fill panel for validation issues. Reused pre-Analyze (local state) and post-Analyze (dispatch). */
export function IssueFixer({ issues, mapping, onFix, onRemove, onRemoveMember, onDismiss }: IssueFixerProps) {
  const groups = useMemo(() => summarizeIssues(issues), [issues])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [bulkValue, setBulkValue] = useState('')

  if (!issues.length) return <p className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">No open data issues.</p>

  function toggle(id: string) {
    setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleGroup(items: Issue[], allSelected: boolean) {
    setSelected((s) => { const next = new Set(s); items.forEach((it) => (allSelected ? next.delete(it.id) : next.add(it.id))); return next })
  }
  function startEdit(issue: BlockingIssue) {
    setEditingId(issue.id); setEditValue(currentRawValue(issue, mapping))
  }
  function submitEdit(issue: Issue) {
    if (!issue.blocking && issue.kind !== 'blank') return
    onFix([issue.id], { [issue.field]: editValue } as Partial<Record<ColumnField, string>>)
    setEditingId(null); setEditValue('')
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const groupSelected = g.items.filter((it) => selected.has(it.id))
        const allSelected = groupSelected.length === g.items.length && g.items.length > 0
        const field = g.items.find((it) => !isDuplicate(it))?.field
        const canBulkDate = g.items.length > 0 && g.items.every((it) => it.blocking && it.kind === 'date')
        const isWarningGroup = g.items.length > 0 && !g.items[0].blocking

        return (
          <div key={g.category} className="rounded-lg border border-line bg-paper p-3">
            <div className="flex items-baseline justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" checked={allSelected} onChange={() => toggleGroup(g.items, allSelected)} />
                {g.category}
              </label>
              <span className="rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-warn" style={{ background: tint('var(--warn)') }}>{g.count.toLocaleString()} rows</span>
            </div>
            {g.hint && <p className="mt-0.5 text-[11px] text-ink-soft">{g.hint}</p>}

            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {g.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded border border-line/60 px-2 py-1 text-[12px]">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                  <span className="flex-1 truncate font-mono text-ink-soft">{it.reason}</span>

                  {isDuplicate(it) ? (
                    it.paymentIds.map((pid) => (
                      <button key={pid} onClick={() => onRemoveMember?.(pid)} className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft hover:text-neg">
                        {pid} ✕
                      </button>
                    ))
                  ) : editingId === it.id ? (
                    <>
                      <input autoFocus type={inputType(it)} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-36 rounded border border-line px-1.5 py-0.5 text-[12px]" />
                      <button onClick={() => submitEdit(it)} className="rounded bg-accent px-2 py-0.5 text-[11px] text-accent-ink">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[11px] text-ink-faint">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => (it.blocking ? startEdit(it) : (setEditingId(it.id), setEditValue('')))}
                        className="text-[11px] text-accent hover:underline"
                      >
                        {it.blocking ? 'Edit' : 'Fill'}
                      </button>
                      <button onClick={() => onRemove([it.id])} className="text-[11px] text-neg hover:underline">Remove</button>
                      {!it.blocking && onDismiss && <button onClick={() => onDismiss([it.id])} className="text-[11px] text-ink-faint hover:underline">Ignore</button>}
                    </>
                  )}
                </div>
              ))}
            </div>

            {groupSelected.length > 0 && !isDuplicate(g.items[0]) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <span className="font-mono text-[11px] text-ink-soft">{groupSelected.length} selected</span>
                <button onClick={() => onRemove(groupSelected.map((it) => it.id))} className="rounded border border-line px-2 py-1 text-[11px] text-neg">Remove selected</button>
                {field && (
                  <>
                    <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="value…"
                      className="w-32 rounded border border-line px-1.5 py-0.5 text-[11px]" />
                    <button onClick={() => onFix(groupSelected.map((it) => it.id), { [field]: bulkValue } as Partial<Record<ColumnField, string>>)}
                      className="rounded border border-line px-2 py-1 text-[11px] text-accent">Fill selected</button>
                  </>
                )}
                {canBulkDate && (
                  <select onChange={(e) => e.target.value && onFix(groupSelected.map((it) => it.id), {}, e.target.value as Exclude<DateOrder, 'auto'>)}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px]" defaultValue="">
                    <option value="" disabled>Re-parse as…</option>
                    {DATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                )}
                {isWarningGroup && onDismiss && (
                  <button onClick={() => onDismiss(groupSelected.map((it) => it.id))} className="rounded border border-line px-2 py-1 text-[11px] text-ink-faint">Ignore selected</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
