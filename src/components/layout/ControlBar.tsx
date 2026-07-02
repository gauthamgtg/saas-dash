'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { MRR_MODES } from '@/src/lib/types'
import { monthRange } from '@/src/lib/types'
import { dimensionValues } from '@/src/lib/dashboard'
import type { MrrMode } from '@/src/lib/types'

export function ControlBar() {
  const { state, dispatch } = useApp()
  const txs = state.transactions ?? []
  const months = useMemo(() => {
    if (!txs.length) return [] as string[]
    const all = txs.map((t) => t.month).sort()
    return monthRange(all[0], all[all.length - 1])
  }, [txs])
  const regions = useMemo(() => dimensionValues(txs, 'region'), [txs])
  const models = useMemo(() => dimensionValues(txs, 'businessModel'), [txs])

  const multi = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-2 text-sm backdrop-blur">
      <label className="flex items-center gap-1">MRR
        <select className="rounded border p-1" value={state.controls.mode}
          onChange={(e) => dispatch({ type: 'setControls', controls: { mode: e.target.value as MrrMode } })}>
          {MRR_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={state.controls.includeRefunds}
          onChange={(e) => dispatch({ type: 'setControls', controls: { includeRefunds: e.target.checked } })} />
        Include refunds
      </label>
      <label className="flex items-center gap-1">From
        <select className="rounded border p-1" value={state.range.start ?? ''}
          onChange={(e) => dispatch({ type: 'setRange', range: { ...state.range, start: e.target.value || null } })}>
          <option value="">start</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1">To
        <select className="rounded border p-1" value={state.range.end ?? ''}
          onChange={(e) => dispatch({ type: 'setRange', range: { ...state.range, end: e.target.value || null } })}>
          <option value="">end</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <details className="relative">
        <summary className="cursor-pointer rounded border px-2 py-1">Regions ({state.filters.regions.length || 'all'})</summary>
        <div className="absolute z-20 mt-1 max-h-56 overflow-auto rounded border bg-white p-2 shadow">
          {regions.map((r) => (
            <label key={r} className="flex items-center gap-1 whitespace-nowrap">
              <input type="checkbox" checked={state.filters.regions.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { regions: multi(state.filters.regions, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
      <details className="relative">
        <summary className="cursor-pointer rounded border px-2 py-1">Models ({state.filters.businessModels.length || 'all'})</summary>
        <div className="absolute z-20 mt-1 max-h-56 overflow-auto rounded border bg-white p-2 shadow">
          {models.map((r) => (
            <label key={r} className="flex items-center gap-1 whitespace-nowrap">
              <input type="checkbox" checked={state.filters.businessModels.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { businessModels: multi(state.filters.businessModels, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
