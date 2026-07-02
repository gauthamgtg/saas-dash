'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, cohorts } from '@/src/lib/engine'
import { Heatmap } from '@/src/components/ui/Heatmap'
import { Callout } from '@/src/components/ui/Callout'

export function Cohorts() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const cs = useMemo(() => cohorts(buildMatrix(txs, state.controls.mode)), [txs, state.controls])

  const net = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.netRetention }))
  const logo = cs.map((c) => ({ label: c.cohortMonth, size: c.size, values: c.logoSurvival }))

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-2 text-xl font-bold">Net revenue retention by cohort</h1>
        <Heatmap rows={net} />
        <Callout>Cell = cohort revenue at age M<sub>n</sub> ÷ its month-0 revenue. &gt;100% = net expansion.</Callout>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">Logo survival by cohort</h2>
        <Heatmap rows={logo} />
      </section>
    </div>
  )
}
