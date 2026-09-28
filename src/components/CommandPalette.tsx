'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, type ViewId } from '@/src/state/AppContext'

/** Fire from anywhere (sidebar button, control bar) to open the palette. */
export const PALETTE_EVENT = 'ledger:palette'

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'briefing', label: 'Executive Briefing' },
  { id: 'board', label: 'Board Pack' },
  { id: 'update', label: 'Investor Update' },
  { id: 'goals', label: 'Goals & Pacing' },
  { id: 'collections', label: 'Cash Calendar' },
  { id: 'churnwarn', label: 'Churn Warning' },
  { id: 'expansion', label: 'Expansion Radar' },
  { id: 'arrbridge', label: 'ARR Bridge' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'issues', label: 'Data Issues' },
  { id: 'overview', label: 'Overview' },
  { id: 'mrr', label: 'MRR' },
  { id: 'growth', label: 'Growth' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'salesreps', label: 'Sales Reps' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'trends', label: 'Trends' },
  { id: 'cohorts', label: 'Cohorts' },
  { id: 'retention', label: 'Retention Lab' },
  { id: 'segments', label: 'Segments' },
  { id: 'customers', label: 'Customers' },
  { id: 'health', label: 'Customer Health' },
  { id: 'risk', label: 'Risk & Concentration' },
  { id: 'bins', label: 'Revenue Bins' },
  { id: 'benchmarks', label: 'Benchmarks' },
  { id: 'unitecon', label: 'Unit Economics' },
  { id: 'efficiency', label: 'Efficiency Lab' },
  { id: 'product', label: 'Product & Deferred' },
  { id: 'connectors', label: 'Workspace & Connectors' },
]

type Cmd = { id: string; label: string; group: string; hint?: string; run: () => void }

export function CommandPalette() {
  const { dispatch } = useApp()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o); setQ(''); setIdx(0)
      } else if (e.key === 'Escape') setOpen(false)
    }
    const onOpen = () => { setOpen(true); setQ(''); setIdx(0) }
    window.addEventListener('keydown', onKey)
    window.addEventListener(PALETTE_EVENT, onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(PALETTE_EVENT, onOpen) }
  }, [])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const cmds = useMemo<Cmd[]>(() => [
    ...VIEWS.map((v) => ({ id: `go-${v.id}`, label: v.label, group: 'Go to', run: () => dispatch({ type: 'setView', view: v.id }) })),
    {
      id: 'theme', label: 'Toggle light / dark theme', group: 'Actions', hint: 'appearance', run: () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        try { localStorage.setItem('ledger-theme', next) } catch {}
      },
    },
    { id: 'present', label: 'Enter present mode', group: 'Actions', hint: 'read-only, no chrome', run: () => dispatch({ type: 'setPresent', present: true }) },
    { id: 'export', label: 'Export · print to PDF', group: 'Actions', run: () => setTimeout(() => window.print(), 120) },
    {
      id: 'reset', label: 'New upload — clear data', group: 'Actions', hint: 'destructive', run: () => {
        if (window.confirm('Clear the analyzed dataset and start over?')) dispatch({ type: 'reset' })
      },
    },
  ], [dispatch])

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? cmds.filter((c) => c.label.toLowerCase().includes(needle)) : cmds
  }, [cmds, q])

  if (!open) return null

  const run = (n: number) => { const c = hits[n]; if (!c) return; setOpen(false); c.run() }
  const groups = [...new Set(hits.map((c) => c.group))]

  return (
    <div className="fade-in fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div className="pop-in mx-auto mt-[14vh] w-[min(560px,92vw)] overflow-hidden rounded-xl border border-line-strong bg-paper shadow-pop"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <span className="text-xs text-ink-faint tabular-nums">›</span>
          <input ref={inputRef} value={q} placeholder="Jump to a view or run an action…"
            className="w-full !border-0 bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-faint focus:!shadow-none"
            onChange={(e) => { setQ(e.target.value); setIdx(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter') run(idx)
            }} />
          <kbd>esc</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto p-1.5">
          {hits.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-faint tabular-nums">No matches for “{q}”</p>}
          {groups.map((g) => (
            <div key={g}>
              <div className="px-2.5 pb-1 pt-2 text-[11px] text-ink-faint font-medium">{g}</div>
              {hits.map((c, n) => c.group !== g ? null : (
                <button key={c.id} onClick={() => run(n)} onMouseEnter={() => setIdx(n)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                    n === idx ? 'text-ink' : 'text-ink-soft'}`}
                  style={n === idx ? { background: 'color-mix(in srgb, var(--accent) 10%, transparent)' } : undefined}>
                  <span>{c.label}</span>
                  {c.hint && <span className="text-[10px] text-ink-faint tabular-nums">{c.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[10px] text-ink-faint tabular-nums">
          <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span className="ml-auto">Ledger</span>
        </div>
      </div>
    </div>
  )
}
