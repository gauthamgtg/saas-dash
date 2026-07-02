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
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
      <div className="mb-3 px-2 text-sm font-bold text-indigo-700">SaaS Analytics</div>
      {ITEMS.map((it) => (
        <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
          className={`rounded px-3 py-2 text-left text-sm ${state.view === it.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}>
          {it.label}
        </button>
      ))}
      <button onClick={() => dispatch({ type: 'reset' })} className="mt-auto rounded px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100">↺ New upload</button>
    </nav>
  )
}
