'use client'
import { useMemo, useState } from 'react'
import type { Issue, BlockingIssue, DuplicateIdIssue, DuplicateRowIssue } from '@/src/lib/normalize'
import { summarizeIssues } from '@/src/lib/issues'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import type { DateOrder } from '@/src/lib/date'
import { Select } from '@/src/components/ui/Select'

const tint = (c: string) => `color-mix(in srgb, ${c} 13%, transparent)`
const DATE_OPTS: { v: Exclude<DateOrder, 'auto'>; label: string }[] = [
  { v: 'dmy', label: 'DD/MM/YYYY' }, { v: 'mdy', label: 'MM/DD/YYYY' }, { v: 'ymd', label: 'YYYY-MM-DD' },
]
const PAGE_SIZE = 100

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

/** Identifying detail so a user can find the actual row — payment ID for warnings, row number for blocking issues. */
function detailOf(it: Issue): string | null {
  if (isDuplicate(it)) return null
  if (it.blocking) return `row ${it.rowIndex + 1}`
  return it.paymentId
}

export type IssueFixerProps = {
  issues: Issue[]
  mapping: Mapping
  onFix: (ids: string[], patch: Partial<Record<ColumnField, string>>, dateOrder?: Exclude<DateOrder, 'auto'>) => void
  onRemove: (ids: string[]) => void
  onRemoveMember?: (paymentId: string) => void
  onRemoveMembers?: (paymentIds: string[]) => void
  onDismiss?: (ids: string[]) => void
}

/** Interactive fix/remove/fill panel for validation issues. Reused pre-Analyze (local state) and post-Analyze (dispatch). */
export function IssueFixer({ issues, mapping, onFix, onRemove, onRemoveMember, onRemoveMembers, onDismiss }: IssueFixerProps) {
  const groups = useMemo(() => summarizeIssues(issues), [issues])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [showAll, setShowAll] = useState(false)

  if (!issues.length) return <p className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">No open data issues.</p>

  const category = activeCategory && groups.some((g) => g.category === activeCategory) ? activeCategory : groups[0].category
  const g = groups.find((x) => x.category === category)!

  function switchTab(cat: string) {
    setActiveCategory(cat); setShowAll(false); setEditingId(null); setSelected(new Set())
  }
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
    setSelected((s) => { if (!s.has(issue.id)) return s; const next = new Set(s); next.delete(issue.id); return next })
    setEditingId(null); setEditValue('')
  }

  const groupIsDuplicate = isDuplicate(g.items[0]) // duplicates get their own bulk actions (keep-first / ignore)
  const groupSelected = g.items.filter((it) => selected.has(it.id))
  const allSelected = groupSelected.length === g.items.length && g.items.length > 0
  const field = g.items.find((it) => !isDuplicate(it))?.field
  const canBulkDate = g.items.length > 0 && g.items.every((it) => it.blocking && it.kind === 'date')
  const isWarningGroup = g.items.length > 0 && !g.items[0].blocking
  const visibleItems = showAll ? g.items : g.items.slice(0, PAGE_SIZE)

  function afterBulkAction(ids: string[]) {
    setSelected((s) => { const next = new Set(s); ids.forEach((id) => next.delete(id)); return next })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-3">
        {groups.map((grp) => (
          <button key={grp.category} onClick={() => switchTab(grp.category)}
            className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium tabular-nums transition-colors ${
              grp.category === category ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:bg-paper-2 hover:text-ink'
            }`}>
            {grp.category} <span className="tabular-nums opacity-70">{grp.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-paper p-3">
        <div className="flex items-baseline justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={allSelected} onChange={() => toggleGroup(g.items, allSelected)} />
            {g.category}
          </label>
          <span className="rounded px-1.5 py-0.5 text-[11px] tabular-nums text-warn" style={{ background: tint('var(--warn)') }}>{g.count.toLocaleString()} rows</span>
        </div>
        {g.hint && <p className="mt-0.5 text-[11px] text-ink-soft">{g.hint}</p>}

        <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
          {visibleItems.map((it) => (
            <div key={it.id} className="flex items-center gap-2 rounded border border-line/60 px-2 py-1 text-[12px]">
              <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
              <span className="flex-1 truncate text-ink-soft tabular-nums">
                {it.reason}
                {detailOf(it) && <span className="ml-2 text-ink-faint">· {detailOf(it)}</span>}
              </span>

              {isDuplicate(it) ? (
                [...new Set(it.paymentIds)].map((pid) => {
                  const count = it.paymentIds.filter((p) => p === pid).length
                  return (
                    <button key={pid} onClick={() => onRemoveMember?.(pid)} title={count > 1 ? `Removes all ${count} rows with this payment ID` : undefined}
                      className="rounded bg-paper-2 px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-neg tabular-nums">
                      {pid}{count > 1 ? ` ×${count}` : ''} ✕
                    </button>
                  )
                })
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
                  <button onClick={() => { onRemove([it.id]); afterBulkAction([it.id]) }} className="text-[11px] text-neg hover:underline">Remove</button>
                  {!it.blocking && onDismiss && <button onClick={() => { onDismiss([it.id]); afterBulkAction([it.id]) }} className="text-[11px] text-ink-faint hover:underline">Ignore</button>}
                </>
              )}
            </div>
          ))}
        </div>

        {g.items.length > PAGE_SIZE && (
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[11px] text-ink-soft tabular-nums">
            <span>Showing {visibleItems.length.toLocaleString()} of {g.items.length.toLocaleString()}</span>
            {!showAll && <button onClick={() => setShowAll(true)} className="text-accent hover:underline">Show all {g.items.length.toLocaleString()}</button>}
            {showAll && <button onClick={() => setShowAll(false)} className="text-accent hover:underline">Show fewer</button>}
          </div>
        )}

        {groupSelected.length > 0 && groupIsDuplicate && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <span className="text-[11px] text-ink-soft tabular-nums">{groupSelected.length} selected</span>
            {onRemoveMembers && (
              <button onClick={() => {
                // keep the first copy of each group, remove the rest; same-payment-ID groups can't be split — resolve those via the chips
                const pids = groupSelected.filter(isDuplicate).flatMap((it) => [...new Set(it.paymentIds)].slice(1))
                if (pids.length) onRemoveMembers(pids)
                afterBulkAction(groupSelected.map((it) => it.id))
              }} className="rounded border border-line px-2 py-1 text-[11px] text-neg">Keep first, remove extras</button>
            )}
            {onDismiss && (
              <button onClick={() => { const ids = groupSelected.map((it) => it.id); onDismiss(ids); afterBulkAction(ids) }} className="rounded border border-line px-2 py-1 text-[11px] text-ink-faint">Ignore selected</button>
            )}
          </div>
        )}

        {groupSelected.length > 0 && !groupIsDuplicate && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
            <span className="text-[11px] text-ink-soft tabular-nums">{groupSelected.length} selected</span>
            <button onClick={() => { const ids = groupSelected.map((it) => it.id); onRemove(ids); afterBulkAction(ids) }} className="rounded border border-line px-2 py-1 text-[11px] text-neg">Remove selected</button>
            {field && (
              <>
                <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="value…"
                  className="w-32 rounded border border-line px-1.5 py-0.5 text-[11px]" />
                <button onClick={() => { const ids = groupSelected.map((it) => it.id); onFix(ids, { [field]: bulkValue } as Partial<Record<ColumnField, string>>); afterBulkAction(ids) }}
                  className="rounded border border-line px-2 py-1 text-[11px] text-accent">Fill selected</button>
              </>
            )}
            {canBulkDate && (
              <Select value="" placeholder="Re-parse as…" options={DATE_OPTS.map((o) => ({ value: o.v, label: o.label }))}
                onChange={(v) => { if (!v) return; const ids = groupSelected.map((it) => it.id); onFix(ids, {}, v as Exclude<DateOrder, 'auto'>); afterBulkAction(ids) }} />
            )}
            {isWarningGroup && onDismiss && (
              <button onClick={() => { const ids = groupSelected.map((it) => it.id); onDismiss(ids); afterBulkAction(ids) }} className="rounded border border-line px-2 py-1 text-[11px] text-ink-faint">Ignore selected</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
