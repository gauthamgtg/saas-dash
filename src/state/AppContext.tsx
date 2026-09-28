'use client'
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { STORAGE_KEY } from './keys'
import { hasPendingFile } from '@/src/lib/pendingImport'
import { sampleTransactions } from '@/src/lib/sampleData'
import type { Transaction, Controls, BinDef } from '@/src/lib/types'
import { DEFAULT_BINS } from '@/src/lib/types'
import type { Mapping } from '@/src/lib/mapping'
import type { FxRates } from '@/src/lib/fx'
import type { BlockingIssue } from '@/src/lib/normalize'
import type { DateOrder } from '@/src/lib/date'
import type { Filters, DateRange } from '@/src/lib/dashboard'
import type { ParsedFile } from '@/src/lib/parse'
import type { SpendRow } from '@/src/lib/spend'
import type { PipelineDeal } from '@/src/lib/pipeline'
import { decodeShare } from '@/src/lib/share'

export type ViewId =
  | 'briefing' | 'board' | 'arrbridge' | 'alerts' | 'issues'
  | 'overview' | 'mrr' | 'growth' | 'forecast' | 'salesreps' | 'pipeline'
  | 'trends' | 'cohorts' | 'retention' | 'segments' | 'customers' | 'health' | 'risk' | 'bins'
  | 'benchmarks' | 'unitecon' | 'efficiency' | 'product' | 'connectors'
  | 'goals' | 'update' | 'collections' | 'churnwarn' | 'expansion' | 'geo' | 'pricing' | 'migrations'

export type Workspace = {
  name: string
  role: 'founder' | 'analyst' | 'investor' | 'advisor'
}

export type ConnectorStatus = {
  stripe: 'disconnected' | 'connecting' | 'connected' | 'error'
  stripeEmail: string | null
  lastSyncAt: string | null // ISO
  mode: 'csv' | 'stripe-key' | 'stripe-oauth' | 'stripe-stub'
}

type State = {
  parsed: ParsedFile | null
  mapping: Mapping | null
  fxRates: FxRates
  transactions: Transaction[] | null
  spend: SpendRow[] | null
  pipeline: PipelineDeal[] | null
  issues: BlockingIssue[]
  resolvedDateOrder: Exclude<DateOrder, 'auto'> | null
  dismissedWarningIds: string[]
  dismissedAlertIds: string[]
  controls: Controls
  filters: Filters
  range: DateRange
  bins: BinDef[]
  view: ViewId
  present: boolean
  workspace: Workspace
  connectors: ConnectorStatus
  /** Optional cash on hand for runway proxy (manual). */
  cashOnHand: number | null
}

const DEFAULT_CONTROLS: Controls = {
  mode: 'activity', includeRefunds: true, reactivationGapK: 1,
  dormancyDays: 90, atRiskStreak: 3, grossMargin: 0.8, comparePeriod: 'yoy',
}

const DEFAULT_WORKSPACE: Workspace = { name: 'My company', role: 'founder' }
const DEFAULT_CONNECTORS: ConnectorStatus = {
  stripe: 'disconnected', stripeEmail: null, lastSyncAt: null, mode: 'csv',
}

const initial: State = {
  parsed: null, mapping: null, fxRates: {}, transactions: null, spend: null, pipeline: null, issues: [],
  resolvedDateOrder: null, dismissedWarningIds: [], dismissedAlertIds: [],
  controls: DEFAULT_CONTROLS, filters: { regions: [], businessModels: [], currencies: [] },
  range: { start: null, end: null }, bins: DEFAULT_BINS, view: 'briefing', present: false,
  workspace: DEFAULT_WORKSPACE, connectors: DEFAULT_CONNECTORS, cashOnHand: null,
}


function persist(s: State) {
  if (typeof localStorage === 'undefined' || !s.transactions || s.present) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      transactions: s.transactions, spend: s.spend, pipeline: s.pipeline, issues: s.issues,
      mapping: s.mapping, fxRates: s.fxRates,
      controls: s.controls, filters: s.filters, range: s.range, bins: s.bins, view: s.view,
      dismissedWarningIds: s.dismissedWarningIds, dismissedAlertIds: s.dismissedAlertIds,
      resolvedDateOrder: s.resolvedDateOrder,
      workspace: s.workspace, connectors: s.connectors, cashOnHand: s.cashOnHand,
    }))
  } catch { /* quota */ }
}

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
      spend: s.spend ?? null, pipeline: s.pipeline ?? null, issues: s.issues ?? [],
      mapping: s.mapping ?? null, fxRates: s.fxRates ?? {},
      controls: { ...DEFAULT_CONTROLS, ...(s.controls ?? {}) },
      filters: s.filters ?? initial.filters, range: s.range ?? initial.range,
      bins: s.bins ?? DEFAULT_BINS, view: s.view ?? 'briefing',
      dismissedWarningIds: s.dismissedWarningIds ?? [], dismissedAlertIds: s.dismissedAlertIds ?? [],
      resolvedDateOrder: s.resolvedDateOrder ?? null,
      workspace: { ...DEFAULT_WORKSPACE, ...(s.workspace ?? {}) },
      connectors: { ...DEFAULT_CONNECTORS, ...(s.connectors ?? {}) },
      cashOnHand: s.cashOnHand ?? null,
    }
  } catch { return null }
}

type Action =
  | { type: 'setParsed'; parsed: ParsedFile; mapping: Mapping }
  | { type: 'setMapping'; mapping: Mapping }
  | { type: 'setFx'; fxRates: FxRates }
  | { type: 'setData'; transactions: Transaction[]; issues: BlockingIssue[]; resolvedDateOrder: Exclude<DateOrder, 'auto'> }
  | { type: 'setSpend'; spend: SpendRow[] | null }
  | { type: 'setPipeline'; pipeline: PipelineDeal[] | null }
  | { type: 'resolveIssues'; results: ({ id: string; transaction: Transaction } | { id: string; issue: BlockingIssue })[] }
  | { type: 'removeIssues'; ids: string[] }
  | { type: 'patchTransactions'; patches: { paymentId: string; patch: Partial<Transaction> }[] }
  | { type: 'removeTransactions'; paymentIds: string[] }
  | { type: 'dismissWarnings'; ids: string[] }
  | { type: 'dismissAlerts'; ids: string[] }
  | { type: 'setControls'; controls: Partial<Controls> }
  | { type: 'setFilters'; filters: Partial<Filters> }
  | { type: 'setRange'; range: DateRange }
  | { type: 'setBins'; bins: BinDef[] }
  | { type: 'setView'; view: ViewId }
  | { type: 'setPresent'; present: boolean }
  | { type: 'setWorkspace'; workspace: Partial<Workspace> }
  | { type: 'setConnectors'; connectors: Partial<ConnectorStatus> }
  | { type: 'setCashOnHand'; cashOnHand: number | null }
  | { type: 'load'; state: State }
  | { type: 'reset' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setParsed': return { ...s, parsed: a.parsed, mapping: a.mapping }
    case 'setMapping': return { ...s, mapping: a.mapping }
    case 'setFx': return { ...s, fxRates: a.fxRates }
    case 'setData': return { ...s, transactions: a.transactions, issues: a.issues, resolvedDateOrder: a.resolvedDateOrder }
    case 'setSpend': return { ...s, spend: a.spend }
    case 'setPipeline': return { ...s, pipeline: a.pipeline }
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
    case 'removeTransactions': {
      const rm = new Set(a.paymentIds)
      return { ...s, transactions: (s.transactions ?? []).filter((t) => !rm.has(t.paymentId)) }
    }
    case 'dismissWarnings': return { ...s, dismissedWarningIds: [...s.dismissedWarningIds, ...a.ids] }
    case 'dismissAlerts': return { ...s, dismissedAlertIds: [...s.dismissedAlertIds, ...a.ids] }
    case 'setControls': return { ...s, controls: { ...s.controls, ...a.controls } }
    case 'setFilters': return { ...s, filters: { ...s.filters, ...a.filters } }
    case 'setRange': return { ...s, range: a.range }
    case 'setBins': return { ...s, bins: a.bins }
    case 'setView': return { ...s, view: a.view }
    case 'setPresent': return { ...s, present: a.present }
    case 'setWorkspace': return { ...s, workspace: { ...s.workspace, ...a.workspace } }
    case 'setConnectors': return { ...s, connectors: { ...s.connectors, ...a.connectors } }
    case 'setCashOnHand': return { ...s, cashOnHand: a.cashOnHand }
    case 'load': return a.state
    case 'reset':
      if (typeof localStorage !== 'undefined') { try { localStorage.removeItem(STORAGE_KEY) } catch {} }
      return { ...initial, workspace: s.workspace } // keep workspace identity across resets
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  // read during render: the importer's own effect (a child) consumes the file before ours runs
  const [importing] = useState(hasPendingFile)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#s=')) {
      decodeShare(hash.slice(3)).then((p) => {
        if (!Array.isArray(p?.transactions) || !p.transactions.length) return
        dispatch({
          type: 'load',
          state: {
            ...initial,
            transactions: p.transactions.map((t: Transaction) => ({ ...t, date: new Date(t.date) })),
            controls: { ...DEFAULT_CONTROLS, ...(p.controls ?? {}) },
            filters: p.filters ?? initial.filters, range: p.range ?? initial.range,
            bins: p.bins ?? DEFAULT_BINS, view: p.view ?? 'overview', present: true,
          },
        })
      })
      return
    }
    // landing-page handoffs: "Open demo" → /app?demo=1; a dropped file → start the importer empty
    const params = new URLSearchParams(window.location.search)
    if (params.get('demo') === '1') {
      window.history.replaceState(null, '', window.location.pathname)
      dispatch({ type: 'setData', transactions: sampleTransactions(), issues: [], resolvedDateOrder: 'mdy' })
      return
    }
    if (importing) return
    const s = loadFromStorage()
    if (s) dispatch({ type: 'load', state: s })
  }, [])
  useEffect(() => {
    persist(state)
  }, [
    state.transactions, state.spend, state.pipeline, state.issues, state.dismissedWarningIds,
    state.dismissedAlertIds, state.controls, state.filters, state.range, state.bins, state.view,
    state.workspace, state.connectors, state.cashOnHand,
  ])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}
