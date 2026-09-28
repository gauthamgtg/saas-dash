'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { encodeShare } from '@/src/lib/share'
import { MRR_MODES } from '@/src/lib/types'
import { monthRange } from '@/src/lib/types'
import { dimensionValues } from '@/src/lib/dashboard'
import type { MrrMode, ComparePeriod } from '@/src/lib/types'
import { ThemeToggle } from '@/src/components/ui/ThemeToggle'
import { Select } from '@/src/components/ui/Select'
import { NAV_ITEMS } from '@/src/lib/nav'

const COMPARE: { v: ComparePeriod; label: string }[] = [
  { v: 'none', label: 'Off' }, { v: 'mom', label: 'MoM' }, { v: 'qoq', label: 'QoQ' }, { v: 'yoy', label: 'YoY' },
]

const LBL = 'text-[12px] font-medium text-ink-soft'
const POP = 'flex h-7 cursor-pointer list-none items-center gap-1 rounded-md border border-line-strong bg-paper px-2.5 shadow-card transition-colors hover:bg-paper-2 [&::-webkit-details-marker]:hidden'
const TRACK = 'inline-flex h-7 items-center rounded-lg border border-line bg-paper-2 p-0.5'
const SEG = 'h-full rounded-[6px] px-2.5 text-[12px] font-medium tabular-nums transition-all'
const SEG_ON = 'bg-paper text-ink shadow-card'
const SEG_OFF = 'text-ink-soft hover:text-ink'
const BTN = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 text-[12.5px] font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2 hover:text-ink'
const NUM = 'h-7 w-16 rounded-md border border-line-strong bg-paper px-2 text-[12px] tabular-nums text-ink outline-none focus:border-accent'
const DIV = 'h-5 w-px bg-line-strong'
const Ico = ({ d }: { d: React.ReactNode }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
)
const Caret = () => <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink-faint" aria-hidden><path d="M2 3.5 5 6.5 8 3.5" /></svg>

export function ControlBar() {
  const { state, dispatch } = useApp()
  const txs = state.transactions ?? []
  const [copied, setCopied] = useState(false)

  async function shareLink() {
    const enc = await encodeShare({
      v: 1, transactions: state.transactions, controls: state.controls,
      filters: state.filters, range: state.range, bins: state.bins, view: state.view,
    })
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}#s=${enc}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2200)
  }
  const months = useMemo(() => {
    if (!txs.length) return [] as string[]
    const all = txs.map((t) => t.month).sort()
    return monthRange(all[0], all[all.length - 1])
  }, [txs])
  const regions = useMemo(() => dimensionValues(txs, 'region'), [txs])
  const models = useMemo(() => dimensionValues(txs, 'businessModel'), [txs])
  const currencies = useMemo(() => dimensionValues(txs, 'currency'), [txs])
  // only offered when the upload mapped an acquisition source column
  const sources = useMemo(() => (txs.some((t) => t.source) ? dimensionValues(txs, 'source') : []), [txs])

  const multi = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const presets = useMemo(() => {
    if (!months.length) return [] as { id: string; label: string; start: string | null }[]
    const end = months[months.length - 1]
    const trailing = (n: number) => months[Math.max(0, months.length - n)]
    return [
      { id: '3m', label: '3M', start: trailing(3) },
      { id: '6m', label: '6M', start: trailing(6) },
      { id: '12m', label: '12M', start: trailing(12) },
      { id: 'ytd', label: 'YTD', start: `${end.slice(0, 4)}-01` },
      { id: 'all', label: 'All', start: null },
    ]
  }, [months])
  const activePreset = presets.find((p) => state.range.start === p.start && state.range.end === null)?.id
  const c = state.controls
  const item = NAV_ITEMS.find((it) => it.id === state.view)
  const activeFilters = state.filters.regions.length + state.filters.businessModels.length + state.filters.currencies.length + (state.filters.sources?.length ?? 0)

  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-bone/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-8">
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="text-ink-faint">{item?.group ?? 'Workspace'}</span>
          <span className="text-ink-faint">/</span>
          <span className="truncate font-semibold text-ink">{item?.label}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={shareLink} title="Copy a read-only link — the data travels inside the URL, no server"
            className={`${BTN} ${copied ? '!border-pos !text-pos' : ''}`}>
            <Ico d={copied ? <path d="m3.5 8.5 3 3 6-7" /> : <><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6" /><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6" /></>} />
            {copied ? 'Link copied' : 'Share'}
          </button>
          <button onClick={() => window.print()} title="Export / print to PDF" className={BTN}>
            <Ico d={<><path d="M8 2.5v7M5 7l3 3 3-3" /><path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" /></>} />Export
          </button>
          <button onClick={() => dispatch({ type: 'setPresent', present: true })} title="Present / read-only mode"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-bone shadow-card transition-opacity hover:opacity-90">
            <Ico d={<><rect x="2" y="3" width="12" height="8.5" rx="1.2" /><path d="M8 11.5V14M5.5 14h5" /></>} />Present
          </button>
          <ThemeToggle compact />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-8 pb-3">
      <div className={TRACK}>
        {presets.map((p) => (
          <button key={p.id} onClick={() => dispatch({ type: 'setRange', range: { start: p.start, end: null } })}
            className={`${SEG} ${activePreset === p.id ? SEG_ON : SEG_OFF}`}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5"><span className="sr-only">From</span>
        <Select value={state.range.start ?? ''} placeholder="start"
          options={[{ value: '', label: 'start' }, ...months.map((m) => ({ value: m, label: m }))]}
          onChange={(v) => dispatch({ type: 'setRange', range: { ...state.range, start: v || null } })} />
      </label>
      <label className="flex items-center gap-1.5"><span className={LBL} aria-hidden>→</span><span className="sr-only">To</span>
        <Select value={state.range.end ?? ''} placeholder="end"
          options={[{ value: '', label: 'end' }, ...months.map((m) => ({ value: m, label: m }))]}
          onChange={(v) => dispatch({ type: 'setRange', range: { ...state.range, end: v || null } })} />
      </label>

      <div className={DIV} />

      <label className="flex items-center gap-1.5"><span className={LBL}>MRR</span>
        <Select value={state.controls.mode} options={MRR_MODES.map((m) => ({ value: m, label: m }))}
          onChange={(v) => dispatch({ type: 'setControls', controls: { mode: v as MrrMode } })} />
      </label>
      <div className="flex items-center gap-1.5">
        <span className={LBL}>Compare</span>
        <div className={TRACK}>
          {COMPARE.map((x) => (
            <button key={x.v} onClick={() => dispatch({ type: 'setControls', controls: { comparePeriod: x.v } })}
              className={`${SEG} ${state.controls.comparePeriod === x.v ? SEG_ON : SEG_OFF}`}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <button role="switch" aria-checked={state.controls.includeRefunds}
        onClick={() => dispatch({ type: 'setControls', controls: { includeRefunds: !state.controls.includeRefunds } })}
        className="flex items-center gap-1.5">
        <span className={`relative h-[15px] w-[26px] rounded-full transition-colors ${state.controls.includeRefunds ? 'bg-accent' : 'bg-line-strong'}`}>
          <span className={`absolute left-0 top-[2px] h-[11px] w-[11px] rounded-full bg-paper shadow-card transition-transform ${state.controls.includeRefunds ? 'translate-x-[13px]' : 'translate-x-[2px]'}`} />
        </span>
        <span className={LBL}>Refunds</span>
      </button>

      <div className={DIV} />

      <details className="relative">
        <summary className={`${POP} ${LBL}`}>
          <Ico d={<path d="M2.5 4h11M4.5 8h7M6.5 12h3" />} />
          Filters{activeFilters > 0 && <span className="ml-0.5 rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-[16px] text-accent-ink">{activeFilters}</span>}<Caret />
        </summary>
        <div className="absolute z-20 mt-1.5 flex max-h-80 w-max gap-1 overflow-auto rounded-lg border border-line bg-paper p-1.5 text-[13px] shadow-pop">
          {([
            ['Region', regions, 'regions'], ['Model', models, 'businessModels'], ['Currency', currencies, 'currencies'], ['Source', sources, 'sources'],
          ] as const).filter(([, vals]) => vals.length > 0).map(([title, vals, key]) => (
            <div key={key} className="min-w-[9rem]">
              <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-ink-faint">{title}</div>
              {vals.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 hover:bg-paper-2">
                  <input type="checkbox" className="accent-accent" checked={(state.filters[key] ?? []).includes(r)}
                    onChange={() => dispatch({ type: 'setFilters', filters: { [key]: multi(state.filters[key] ?? [], r) } })} />{r}
                </label>
              ))}
            </div>
          ))}
        </div>
      </details>

      <details className="relative">
        <summary className={`${POP} ${LBL}`}>Assumptions<Caret /></summary>
        <div className="absolute z-20 mt-1.5 w-72 space-y-2.5 rounded-lg border border-line bg-paper p-3 text-sm shadow-pop">
          <label className="flex items-center justify-between gap-2">
            <span className={LBL}>Gross margin</span>
            <span className="flex items-center gap-1">
              <input type="number" min={0} max={100} step={1} className={NUM}
                value={Math.round(c.grossMargin * 100)}
                onChange={(e) => dispatch({ type: 'setControls', controls: { grossMargin: Math.min(1, Math.max(0, Number(e.target.value) / 100 || 0)) } })} />
              <span className="text-[11px] text-ink-faint">%</span>
            </span>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className={LBL}>At-risk streak</span>
            <span className="flex items-center gap-1">
              <input type="number" min={1} max={12} step={1} className={NUM}
                value={c.atRiskStreak}
                onChange={(e) => dispatch({ type: 'setControls', controls: { atRiskStreak: Math.max(1, Number(e.target.value) || 1) } })} />
              <span className="text-[11px] text-ink-faint">mo</span>
            </span>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className={LBL}>Dormancy</span>
            <span className="flex items-center gap-1">
              <input type="number" min={14} max={365} step={1} className={NUM}
                value={c.dormancyDays}
                onChange={(e) => dispatch({ type: 'setControls', controls: { dormancyDays: Math.max(1, Number(e.target.value) || 90) } })} />
              <span className="text-[11px] text-ink-faint">days</span>
            </span>
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className={LBL}>Reactivation gap</span>
            <span className="flex items-center gap-1">
              <input type="number" min={1} max={12} step={1} className={NUM}
                value={c.reactivationGapK}
                onChange={(e) => dispatch({ type: 'setControls', controls: { reactivationGapK: Math.max(1, Number(e.target.value) || 1) } })} />
              <span className="text-[11px] text-ink-faint">mo</span>
            </span>
          </label>
          <p className="text-[11px] leading-relaxed text-ink-faint">Used for LTV, at-risk flags, dormant lists, and reactivation vs new classification.</p>
        </div>
      </details>

      </div>
    </div>
  )
}
