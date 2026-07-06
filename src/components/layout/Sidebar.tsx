'use client'
import { useMemo } from 'react'
import { useApp, type ViewId } from '@/src/state/AppContext'
import { findWarnings } from '@/src/lib/issues'

const ITEMS: { id: ViewId; label: string; idx: string; group: string }[] = [
  { id: 'briefing', label: 'Executive Briefing', idx: '00', group: 'Executive' },
  { id: 'issues', label: 'Data Issues', idx: '01', group: 'Executive' },
  { id: 'overview', label: 'Overview', idx: '01', group: 'Analysis' },
  { id: 'growth', label: 'Growth', idx: '02', group: 'Analysis' },
  { id: 'trends', label: 'Trends', idx: '03', group: 'Analysis' },
  { id: 'cohorts', label: 'Cohorts', idx: '04', group: 'Analysis' },
  { id: 'segments', label: 'Segments', idx: '05', group: 'Analysis' },
  { id: 'customers', label: 'Customers', idx: '06', group: 'Analysis' },
  { id: 'health', label: 'Customer Health', idx: '07', group: 'Analysis' },
  { id: 'bins', label: 'Revenue Bins', idx: '08', group: 'Analysis' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  const issueCount = useMemo(() => {
    const warnings = state.transactions ? findWarnings(state.transactions).filter((w) => !state.dismissedWarningIds.includes(w.id)) : []
    return state.issues.length + warnings.length
  }, [state.transactions, state.issues, state.dismissedWarningIds])

  return (
    <nav className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-paper/70 px-3 py-5 backdrop-blur">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-display text-lg font-bold text-bone shadow-card">L</div>
        <div>
          <div className="font-display text-[15px] font-bold leading-none tracking-tight text-ink">Ledger</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-ink-soft">Revenue Terminal</div>
        </div>
      </div>

      {['Executive', 'Analysis'].map((group) => (
        <div key={group} className="mb-2">
          <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-ink-faint">{group}</div>
          {ITEMS.filter((it) => it.group === group).map((it) => {
            const active = state.view === it.id
            return (
              <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-accent text-accent-ink shadow-card' : 'text-ink-soft hover:bg-paper-2 hover:text-ink'}`}>
                <span className={`font-mono text-[10px] tabular-nums ${active ? 'text-accent-ink opacity-70' : 'text-ink-faint'}`}>{it.idx}</span>
                <span className="flex-1">{it.label}</span>
                {it.id === 'issues' && issueCount > 0 && (
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${active ? 'bg-accent-ink/20 text-accent-ink' : 'bg-warn/15 text-warn'}`}>{issueCount}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}

      <button onClick={() => dispatch({ type: 'reset' })}
        className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink">
        ↺ New upload
      </button>
    </nav>
  )
}
