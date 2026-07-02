'use client'
import { useApp } from '@/src/state/AppContext'
import { Dropzone } from '@/src/components/upload/Dropzone'
import { DataIssues } from '@/src/components/upload/DataIssues'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { ControlBar } from '@/src/components/layout/ControlBar'
import { Overview } from '@/src/components/views/Overview'
import { Growth } from '@/src/components/views/Growth'
import { Trends } from '@/src/components/views/Trends'
import { Cohorts } from '@/src/components/views/Cohorts'
import { Segments } from '@/src/components/views/Segments'
import { Customers } from '@/src/components/views/Customers'
import { Health } from '@/src/components/views/Health'
import { Bins } from '@/src/components/views/Bins'

export function Shell() {
  const { state } = useApp()
  if (!state.transactions) return <Dropzone />
  const view = {
    overview: <Overview />, growth: <Growth />, trends: <Trends />, cohorts: <Cohorts />,
    segments: <Segments />, customers: <Customers />, health: <Health />, bins: <Bins />,
  }[state.view]
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <ControlBar />
        <main className="mx-auto max-w-6xl space-y-6 p-6">
          {state.issues.length > 0 && <DataIssues issues={state.issues} />}
          {view}
        </main>
      </div>
    </div>
  )
}
