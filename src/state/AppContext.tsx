'use client'
import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { Transaction, Controls, BinDef } from '@/src/lib/types'
import { DEFAULT_BINS } from '@/src/lib/types'
import type { Mapping } from '@/src/lib/mapping'
import type { FxRates } from '@/src/lib/fx'
import type { BlockingIssue } from '@/src/lib/normalize'
import type { DateOrder } from '@/src/lib/date'
import type { Filters, DateRange } from '@/src/lib/dashboard'
import type { ParsedFile } from '@/src/lib/parse'

export type ViewId = 'briefing' | 'issues' | 'overview' | 'growth' | 'trends' | 'cohorts' | 'segments' | 'customers' | 'health' | 'bins'

type State = {
  parsed: ParsedFile | null
  mapping: Mapping | null
  fxRates: FxRates
  transactions: Transaction[] | null
  issues: BlockingIssue[]
  resolvedDateOrder: Exclude<DateOrder, 'auto'> | null
  dismissedWarningIds: string[]
  controls: Controls
  filters: Filters
  range: DateRange
  bins: BinDef[]
  view: ViewId
  present: boolean // present/read-only mode — hides chrome for sharing
}

const DEFAULT_CONTROLS: Controls = {
  mode: 'activity', includeRefunds: true, reactivationGapK: 1,
  dormancyDays: 90, atRiskStreak: 3, grossMargin: 0.8, comparePeriod: 'yoy',
}

const initial: State = {
  parsed: null, mapping: null, fxRates: {}, transactions: null, issues: [],
  resolvedDateOrder: null, dismissedWarningIds: [],
  controls: DEFAULT_CONTROLS, filters: { regions: [], businessModels: [], currencies: [] },
  range: { start: null, end: null }, bins: DEFAULT_BINS, view: 'briefing', present: false,
}

const STORAGE_KEY = 'ledger-state-v1'

/** Persist the analyzed dataset + settings so a reload keeps the dashboard (client-only "session"). */
function persist(s: State) {
  if (typeof localStorage === 'undefined' || !s.transactions) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      transactions: s.transactions, issues: s.issues, mapping: s.mapping, fxRates: s.fxRates,
      controls: s.controls, filters: s.filters, range: s.range, bins: s.bins, view: s.view,
      dismissedWarningIds: s.dismissedWarningIds, resolvedDateOrder: s.resolvedDateOrder,
    }))
  } catch { /* quota exceeded on very large uploads — skip persistence, app still works in-memory */ }
}

/** Read persisted state (client-only, after mount — avoids SSR hydration mismatch). null if nothing usable. */
function loadFromStorage(): State | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!Array.isArray(s.transactions) || !s.transactions.length) return null
    return {
      ...initial,
      transactions: s.transactions.map((t: Transaction) => ({ ...t, date: new Date(t.date) })),
      issues: s.issues ?? [], mapping: s.mapping ?? null, fxRates: s.fxRates ?? {},
      controls: { ...DEFAULT_CONTROLS, ...(s.controls ?? {}) },
      filters: s.filters ?? initial.filters, range: s.range ?? initial.range,
      bins: s.bins ?? DEFAULT_BINS, view: s.view ?? 'briefing',
      dismissedWarningIds: s.dismissedWarningIds ?? [], resolvedDateOrder: s.resolvedDateOrder ?? null,
    }
  } catch { return null }
}

type Action =
  | { type: 'setParsed'; parsed: ParsedFile; mapping: Mapping }
  | { type: 'setMapping'; mapping: Mapping }
  | { type: 'setFx'; fxRates: FxRates }
  | { type: 'setData'; transactions: Transaction[]; issues: BlockingIssue[]; resolvedDateOrder: Exclude<DateOrder, 'auto'> }
  | { type: 'resolveIssues'; results: ({ id: string; transaction: Transaction } | { id: string; issue: BlockingIssue })[] }
  | { type: 'removeIssues'; ids: string[] }
  | { type: 'patchTransactions'; patches: { paymentId: string; patch: Partial<Transaction> }[] }
  | { type: 'removeTransactions'; paymentIds: string[] }
  | { type: 'dismissWarnings'; ids: string[] }
  | { type: 'setControls'; controls: Partial<Controls> }
  | { type: 'setFilters'; filters: Partial<Filters> }
  | { type: 'setRange'; range: DateRange }
  | { type: 'setBins'; bins: BinDef[] }
  | { type: 'setView'; view: ViewId }
  | { type: 'setPresent'; present: boolean }
  | { type: 'load'; state: State }
  | { type: 'reset' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setParsed': return { ...s, parsed: a.parsed, mapping: a.mapping }
    case 'setMapping': return { ...s, mapping: a.mapping }
    case 'setFx': return { ...s, fxRates: a.fxRates }
    case 'setData': return { ...s, transactions: a.transactions, issues: a.issues, resolvedDateOrder: a.resolvedDateOrder }
    case 'resolveIssues': {
      const resultById = new Map(a.results.map((r) => [r.id, r]))
      const issues = s.issues
        .filter((it) => !(resultById.get(it.id) && 'transaction' in resultById.get(it.id)!))
        .map((it) => { const r = resultById.get(it.id); return r && 'issue' in r ? r.issue : it })
      const newTransactions = a.results.filter((r): r is { id: string; transaction: Transaction } => 'transaction' in r).map((r) => r.transaction)
      return { ...s, issues, transactions: [...(s.transactions ?? []), ...newTransactions] }
    }
    case 'removeIssues': return { ...s, issues: s.issues.filter((it) => !a.ids.includes(it.id)) }
    case 'patchTransactions': {
      const patchByPid = new Map(a.patches.map((p) => [p.paymentId, p.patch]))
      return { ...s, transactions: (s.transactions ?? []).map((t) => patchByPid.has(t.paymentId) ? { ...t, ...patchByPid.get(t.paymentId) } : t) }
    }
    case 'removeTransactions': return { ...s, transactions: (s.transactions ?? []).filter((t) => !a.paymentIds.includes(t.paymentId)) }
    case 'dismissWarnings': return { ...s, dismissedWarningIds: [...s.dismissedWarningIds, ...a.ids] }
    case 'setControls': return { ...s, controls: { ...s.controls, ...a.controls } }
    case 'setFilters': return { ...s, filters: { ...s.filters, ...a.filters } }
    case 'setRange': return { ...s, range: a.range }
    case 'setBins': return { ...s, bins: a.bins }
    case 'setView': return { ...s, view: a.view }
    case 'setPresent': return { ...s, present: a.present }
    case 'load': return a.state
    case 'reset':
      if (typeof localStorage !== 'undefined') { try { localStorage.removeItem(STORAGE_KEY) } catch {} }
      return initial
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  useEffect(() => { const s = loadFromStorage(); if (s) dispatch({ type: 'load', state: s }) }, [])
  useEffect(() => { persist(state) }, [state.transactions, state.issues, state.dismissedWarningIds, state.controls, state.filters, state.range, state.bins, state.view])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}
