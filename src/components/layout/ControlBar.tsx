'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { MRR_MODES } from '@/src/lib/types'
import { monthRange } from '@/src/lib/types'
import { dimensionValues } from '@/src/lib/dashboard'
import type { MrrMode } from '@/src/lib/types'

const LBL = 'font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft'
const CTL = 'px-2 py-1 text-sm'

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
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-paper/95 px-5 py-2.5 backdrop-blur">
      <label className="flex items-center gap-1.5"><span className={LBL}>MRR</span>
        <select className={CTL} value={state.controls.mode}
          onChange={(e) => dispatch({ type: 'setControls', controls: { mode: e.target.value as MrrMode } })}>
          {MRR_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" className="accent-navy" checked={state.controls.includeRefunds}
          onChange={(e) => dispatch({ type: 'setControls', controls: { includeRefunds: e.target.checked } })} />
        <span className={LBL}>Refunds</span>
      </label>
      <label className="flex items-center gap-1.5"><span className={LBL}>From</span>
        <select className={CTL} value={state.range.start ?? ''}
          onChange={(e) => dispatch({ type: 'setRange', range: { ...state.range, start: e.target.value || null } })}>
          <option value="">start</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5"><span className={LBL}>To</span>
        <select className={CTL} value={state.range.end ?? ''}
          onChange={(e) => dispatch({ type: 'setRange', range: { ...state.range, end: e.target.value || null } })}>
          <option value="">end</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <details className="relative">
        <summary className={`cursor-pointer border border-line-strong px-2 py-1 ${LBL}`}>Regions · {state.filters.regions.length || 'all'}</summary>
        <div className="absolute z-20 mt-1 max-h-56 overflow-auto border border-line-strong bg-paper p-2 text-sm shadow-sm">
          {regions.map((r) => (
            <label key={r} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
              <input type="checkbox" className="accent-navy" checked={state.filters.regions.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { regions: multi(state.filters.regions, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
      <details className="relative">
        <summary className={`cursor-pointer border border-line-strong px-2 py-1 ${LBL}`}>Models · {state.filters.businessModels.length || 'all'}</summary>
        <div className="absolute z-20 mt-1 max-h-56 overflow-auto border border-line-strong bg-paper p-2 text-sm shadow-sm">
          {models.map((r) => (
            <label key={r} className="flex items-center gap-1.5 whitespace-nowrap py-0.5">
              <input type="checkbox" className="accent-navy" checked={state.filters.businessModels.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { businessModels: multi(state.filters.businessModels, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
