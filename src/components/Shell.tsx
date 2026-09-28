'use client'
import { useEffect } from 'react'
import { useApp } from '@/src/state/AppContext'
import { Dropzone } from '@/src/components/upload/Dropzone'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { ControlBar } from '@/src/components/layout/ControlBar'
import { Ticker } from '@/src/components/layout/Ticker'
import { Briefing } from '@/src/components/views/Briefing'
import { BoardPack } from '@/src/components/views/BoardPack'
import { ArrBridgeView } from '@/src/components/views/ArrBridgeView'
import { Alerts } from '@/src/components/views/Alerts'
import { DataIssues } from '@/src/components/views/DataIssues'
import { Overview } from '@/src/components/views/Overview'
import { Mrr } from '@/src/components/views/Mrr'
import { Growth } from '@/src/components/views/Growth'
import { Forecast } from '@/src/components/views/Forecast'
import { SalesReps } from '@/src/components/views/SalesReps'
import { Pipeline } from '@/src/components/views/Pipeline'
import { Trends } from '@/src/components/views/Trends'
import { Cohorts } from '@/src/components/views/Cohorts'
import { RetentionLab } from '@/src/components/views/RetentionLab'
import { Segments } from '@/src/components/views/Segments'
import { Customers } from '@/src/components/views/Customers'
import { Health } from '@/src/components/views/Health'
import { Risk } from '@/src/components/views/Risk'
import { Bins } from '@/src/components/views/Bins'
import { Benchmarks } from '@/src/components/views/Benchmarks'
import { UnitEconomics } from '@/src/components/views/UnitEconomics'
import { EfficiencyLab } from '@/src/components/views/EfficiencyLab'
import { ProductLab } from '@/src/components/views/ProductLab'
import { Connectors } from '@/src/components/views/Connectors'
import { Goals } from '@/src/components/views/Goals'
import { InvestorUpdate } from '@/src/components/views/InvestorUpdate'
import { Collections } from '@/src/components/views/Collections'
import { ChurnWarning, ExpansionRadar } from '@/src/components/views/Signals'
import { CommandPalette } from '@/src/components/CommandPalette'

export function Shell() {
  const { state, dispatch } = useApp()
  useEffect(() => { window.scrollTo(0, 0) }, [state.view])
  if (!state.transactions) return <Dropzone />
  const view = {
    briefing: <Briefing />, board: <BoardPack />, arrbridge: <ArrBridgeView />, alerts: <Alerts />, issues: <DataIssues />,
    overview: <Overview />, mrr: <Mrr />, growth: <Growth />, forecast: <Forecast />,
    salesreps: <SalesReps />, pipeline: <Pipeline />,
    trends: <Trends />, cohorts: <Cohorts />, retention: <RetentionLab />, segments: <Segments />,
    customers: <Customers />, health: <Health />, risk: <Risk />, bins: <Bins />,
    benchmarks: <Benchmarks />, unitecon: <UnitEconomics />, efficiency: <EfficiencyLab />,
    product: <ProductLab />, connectors: <Connectors />,
    goals: <Goals />, update: <InvestorUpdate />, collections: <Collections />,
    churnwarn: <ChurnWarning />, expansion: <ExpansionRadar />,
  }[state.view]

  if (state.present) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 p-8">
        <CommandPalette />
        <button onClick={() => dispatch({ type: 'setPresent', present: false })}
          className="no-print fixed right-4 top-4 z-50 rounded-md border border-line-strong bg-paper px-3 py-1 text-[12px] text-ink-soft shadow-card hover:text-ink font-medium">✕ Exit present</button>
        {view}
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <CommandPalette />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <ControlBar />
        <Ticker />
        <main key={state.view} className="stagger mx-auto max-w-7xl space-y-6 p-8">
          {view}
        </main>
      </div>
    </div>
  )
}
