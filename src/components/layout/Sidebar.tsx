'use client'
import { useApp, type ViewId } from '@/src/state/AppContext'

const ITEMS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'growth', label: 'Growth' },
  { id: 'cohorts', label: 'Cohorts' }, { id: 'segments', label: 'Segments' },
  { id: 'customers', label: 'Customers' }, { id: 'bins', label: 'Revenue Bins' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  return (
    <nav className="flex w-56 shrink-0 flex-col gap-0.5 border-r border-line bg-paper p-4">
      <div className="mb-7 px-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-soft">Revenue</div>
        <div className="font-display text-xl font-bold tracking-tight text-ink">Ledger</div>
      </div>
      {ITEMS.map((it, idx) => {
        const active = state.view === it.id
        return (
          <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
            className={`flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-navy text-white' : 'text-ink-soft hover:bg-bone hover:text-ink'}`}>
            <span className={`font-mono text-[10px] tabular-nums ${active ? 'text-white/60' : 'text-ink-faint'}`}>{String(idx + 1).padStart(2, '0')}</span>
            {it.label}
          </button>
        )
      })}
      <button onClick={() => dispatch({ type: 'reset' })}
        className="mt-auto px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint hover:text-ink">
        ↺ New upload
      </button>
    </nav>
  )
}
