'use client'
import { useApp } from '@/src/state/AppContext'
import { Dropzone } from '@/src/components/upload/Dropzone'
import { DataIssues } from '@/src/components/upload/DataIssues'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { ControlBar } from '@/src/components/layout/ControlBar'
import { Briefing } from '@/src/components/views/Briefing'
import { Overview } from '@/src/components/views/Overview'
import { Growth } from '@/src/components/views/Growth'
import { Trends } from '@/src/components/views/Trends'
import { Cohorts } from '@/src/components/views/Cohorts'
import { Segments } from '@/src/components/views/Segments'
import { Customers } from '@/src/components/views/Customers'
import { Health } from '@/src/components/views/Health'
import { Bins } from '@/src/components/views/Bins'

export function Shell() {
  const { state, dispatch } = useApp()
  if (!state.transactions) return <Dropzone />
  const view = {
    briefing: <Briefing />, overview: <Overview />, growth: <Growth />, trends: <Trends />, cohorts: <Cohorts />,
    segments: <Segments />, customers: <Customers />, health: <Health />, bins: <Bins />,
  }[state.view]

  if (state.present) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 p-8">
        <button onClick={() => dispatch({ type: 'setPresent', present: false })}
          className="no-print fixed right-4 top-4 z-50 rounded-md border border-line-strong bg-paper px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft shadow-card hover:text-ink">✕ Exit present</button>
        {view}
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <ControlBar />
        <main key={state.view} className="rise mx-auto max-w-7xl space-y-6 p-8">
          {state.issues.length > 0 && <DataIssues issues={state.issues} />}
          {view}
        </main>
      </div>
    </div>
  )
}
