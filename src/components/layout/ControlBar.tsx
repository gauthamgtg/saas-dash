'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { MRR_MODES } from '@/src/lib/types'
import { monthRange } from '@/src/lib/types'
import { dimensionValues } from '@/src/lib/dashboard'
import type { MrrMode, ComparePeriod } from '@/src/lib/types'
import { ThemeToggle } from '@/src/components/ui/ThemeToggle'

const COMPARE: { v: ComparePeriod; label: string }[] = [
  { v: 'none', label: 'off' }, { v: 'mom', label: 'MoM' }, { v: 'qoq', label: 'QoQ' }, { v: 'yoy', label: 'YoY' },
]

const LBL = 'font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft'
const CTL = 'rounded-md px-2 py-1 text-sm'
const POP = 'cursor-pointer rounded-md border border-line-strong bg-paper-2 px-2.5 py-1'

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
    <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bone/80 px-6 py-3 backdrop-blur-md">
      <label className="flex items-center gap-1.5"><span className={LBL}>MRR</span>
        <select className={CTL} value={state.controls.mode}
          onChange={(e) => dispatch({ type: 'setControls', controls: { mode: e.target.value as MrrMode } })}>
          {MRR_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 text-sm">
        <input type="checkbox" className="accent-accent" checked={state.controls.includeRefunds}
          onChange={(e) => dispatch({ type: 'setControls', controls: { includeRefunds: e.target.checked } })} />
        <span className={LBL}>Refunds</span>
      </label>
      <label className="flex items-center gap-1.5"><span className={LBL}>Compare</span>
        <select className={CTL} value={state.controls.comparePeriod}
          onChange={(e) => dispatch({ type: 'setControls', controls: { comparePeriod: e.target.value as ComparePeriod } })}>
          {COMPARE.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
      </label>
      <div className="h-4 w-px bg-line-strong" />
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
      <div className="h-4 w-px bg-line-strong" />
      <details className="relative">
        <summary className={`${POP} ${LBL}`}>Regions · {state.filters.regions.length || 'all'}</summary>
        <div className="absolute z-20 mt-1.5 max-h-56 overflow-auto rounded-lg border border-line-strong bg-paper-2 p-2 text-sm shadow-pop">
          {regions.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-1 py-0.5 hover:bg-paper">
              <input type="checkbox" className="accent-accent" checked={state.filters.regions.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { regions: multi(state.filters.regions, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
      <details className="relative">
        <summary className={`${POP} ${LBL}`}>Models · {state.filters.businessModels.length || 'all'}</summary>
        <div className="absolute z-20 mt-1.5 max-h-56 overflow-auto rounded-lg border border-line-strong bg-paper-2 p-2 text-sm shadow-pop">
          {models.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded px-1 py-0.5 hover:bg-paper">
              <input type="checkbox" className="accent-accent" checked={state.filters.businessModels.includes(r)}
                onChange={() => dispatch({ type: 'setFilters', filters: { businessModels: multi(state.filters.businessModels, r) } })} />{r}
            </label>
          ))}
        </div>
      </details>
      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => window.print()} title="Export / print to PDF"
          className="rounded-md border border-line-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink">⤓ Export</button>
        <button onClick={() => dispatch({ type: 'setPresent', present: true })} title="Present / read-only mode"
          className="rounded-md border border-line-strong px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink">◱ Present</button>
        <ThemeToggle />
      </div>
    </div>
  )
}
