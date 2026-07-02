# SaaS Dashboard UI Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, with a running dev server for visual verification). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Next.js (App Router) client-side dashboard on top of the Plan 1 engine: upload CSV/Excel → map columns → set FX → explore 7 analytics views. Deploys to Vercel.

**Architecture:** One client page. All state (parsed file, mapping, FX rates, controls, bin config, transactions) lives in a React context `AppProvider`; the `Matrix` and per-view data are `useMemo`-derived. A pure `src/lib/dashboard.ts` layer (filters + per-view models) sits between the engine and the components so all data-shaping is unit-tested and components stay thin. View switching is client state (data is in-memory and ephemeral — no routing that would drop it).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, Recharts, plus the Plan 1 engine (`src/lib/**`). Existing Vitest suite continues to cover pure logic.

**Engine API this plan consumes (exact signatures, from Plan 1):**
- `buildMatrix(txs, mode, range?) -> Matrix`; `get(m,c,month)`, `mrrOf(m,month)`, `activeCustomers(m,month)`
- `movementSeries(m, {reactivationGapK}) -> Movement[]` (`month,prevMonth,newMrr,expansion,contraction,churn,reactivation,netNew`)
- `cohorts(m) -> Cohort[]` (`cohortMonth,size,netRetention[],grossRetention[],logoSurvival[]`)
- `binAnalysis(m,month,defs) -> {month,total,bins:BinRow[]}`, `binSeries(m,defs)`; `BinRow{label,customers,revenue,share,avgMrr,avgAcv}`
- `arr,arpa,momGrowth,yoyGrowth,nrr,grr,logoChurnRate,avgLifetimeMonths,ltvRevenue`
- `revenueByDimension(txs,dim)`, `topCustomers(txs,n)`, `topNShare(txs,n)`, `hhi(txs)`
- `atRisk(m,c,streak)`, `perCustomerRefundRate(txs,c)`, `recencyDays(txs,c,asOf)`, `dormantCustomers(txs,asOf,days)`
- `parseFile(File)`, `autoDetect(headers)`, `missingRequired(mapping)`, `detectCurrencies(values)`, `normalize(rows,mapping,rates,{includeRefunds})`
- types: `Transaction, Matrix, MrrMode, MRR_MODES, BinDef, DEFAULT_BINS, Controls, monthKey, monthRange, monthDiff`

**Companion docs:** spec `docs/superpowers/specs/2026-07-02-...-design.md`; metrics `docs/metrics-catalog.md`; engine plan `docs/superpowers/plans/2026-07-02-analytics-engine.md`.

---

## File Structure

```
next.config.mjs, postcss.config.mjs, tailwind.config.ts, app/globals.css
app/layout.tsx                 root layout (metadata, globals)
app/page.tsx                   'use client' entry: AppProvider + Shell
src/lib/dashboard.ts           PURE: applyFilters + per-view models (unit-tested)
src/state/AppContext.tsx       context + reducer: raw data, mapping, fx, controls, bins, view
src/components/Shell.tsx       upload-gate -> Sidebar + ControlBar + active view
src/components/upload/Dropzone.tsx, MappingForm.tsx, FxForm.tsx, DataIssues.tsx
src/components/layout/Sidebar.tsx, ControlBar.tsx
src/components/ui/KpiCard.tsx, TrendChart.tsx, BarsChart.tsx, Heatmap.tsx, DataTable.tsx, Callout.tsx
src/components/views/Overview.tsx, Growth.tsx, Cohorts.tsx, Segments.tsx, Customers.tsx, Bins.tsx
src/lib/format.ts              money/percent/number formatters
```

---

## Task 1: Next.js + Tailwind scaffold

**Files:** `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1: Install**

```bash
npm i next@14 react react-dom recharts
npm i -D @types/react @types/react-dom autoprefixer postcss tailwindcss
```

- [ ] **Step 2: Add Next scripts to `package.json`** (keep existing `test`/`test:watch`)

```json
"scripts": { "dev": "next dev", "build": "next build", "start": "next start", "test": "vitest run", "test:watch": "vitest" }
```

- [ ] **Step 3: `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }
export default nextConfig
```

- [ ] **Step 4: `postcss.config.mjs`**

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

- [ ] **Step 5: `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

- [ ] **Step 6: `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
:root { color-scheme: light; }
body { @apply bg-slate-50 text-slate-800; }
```

- [ ] **Step 7: `app/layout.tsx`**

```tsx
import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'SaaS Revenue Analytics', description: 'Upload revenue data, get full analytics.' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>)
}
```

- [ ] **Step 8: `app/page.tsx` (placeholder to boot)**

```tsx
'use client'
export default function Page() {
  return <main className="p-8 text-xl font-semibold">SaaS Revenue Analytics — scaffold OK</main>
}
```

- [ ] **Step 9: Verify + commit**

Run: `npm run build` → expect success. Then `npm run dev`, open the URL, confirm the placeholder renders.
```bash
git add -A && git commit -m "chore(ui): next.js + tailwind scaffold"
```

---

## Task 2: Pure dashboard model + formatters (unit-tested)

**Files:** Create `src/lib/format.ts`, `src/lib/dashboard.ts`, `src/lib/dashboard.test.ts`

This is the only heavily-tested UI task — it shapes engine output for the views. Keep components dumb by putting all filtering/derivation here.

- [ ] **Step 1: `src/lib/format.ts`**

```ts
export const fmtMoney = (n: number | null, ccy = '$') =>
  n == null ? '—' : `${ccy}${Math.round(n).toLocaleString('en-US')}`
export const fmtPct = (x: number | null, digits = 1) =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`
export const fmtNum = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'))
```

- [ ] **Step 2: Write the failing test `src/lib/dashboard.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { applyFilters, dimensionValues, overviewModel } from './dashboard'
import { scenario } from './testdata'

describe('applyFilters', () => {
  const txs = scenario()
  it('filters by region', () => {
    const r = applyFilters(txs, { regions: ['EU'], businessModels: [], currencies: [] }, { start: null, end: null })
    expect(r.every((t) => t.region === 'EU')).toBe(true)
    expect(r).toHaveLength(2) // c3 has 2 rows
  })
  it('filters by month range inclusive', () => {
    const r = applyFilters(txs, { regions: [], businessModels: [], currencies: [] }, { start: '2026-02', end: '2026-03' })
    expect(r.every((t) => t.month >= '2026-02')).toBe(true)
    expect(r.some((t) => t.month === '2026-01')).toBe(false)
  })
  it('empty filters return all rows', () => {
    expect(applyFilters(txs, { regions: [], businessModels: [], currencies: [] }, { start: null, end: null })).toHaveLength(txs.length)
  })
})

describe('dimensionValues', () => {
  it('lists distinct sorted values for a dimension', () => {
    expect(dimensionValues(scenario(), 'region')).toEqual(['EU', 'NA'])
  })
})

describe('overviewModel', () => {
  it('produces the latest-month headline KPIs', () => {
    const model = overviewModel(scenario(), { mode: 'activity', includeRefunds: true, reactivationGapK: 1, dormancyDays: 90, atRiskStreak: 3, grossMargin: 0.8 })
    expect(model.month).toBe('2026-03')
    expect(model.mrr).toBe(600) // 150 + 200 + 250
    expect(model.arr).toBe(7200)
    expect(model.activeCustomers).toBe(3)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/lib/dashboard.test.ts` → FAIL (module missing).

- [ ] **Step 4: `src/lib/dashboard.ts`**

```ts
import type { Transaction, Controls } from './types'
import { buildMatrix, mrrOf, activeCustomers } from './engine/matrix'
import { arr, arpa, logoChurnRate, avgLifetimeMonths } from './engine/kpis'
import { addMonths } from './types'

export type Filters = { regions: string[]; businessModels: string[]; currencies: string[] }
export type DateRange = { start: string | null; end: string | null }
type DimKey = 'region' | 'country' | 'businessModel' | 'currency'

export function applyFilters(txs: Transaction[], f: Filters, range: DateRange): Transaction[] {
  return txs.filter((t) => {
    if (f.regions.length && !f.regions.includes(t.region ?? 'Unknown')) return false
    if (f.businessModels.length && !f.businessModels.includes(t.businessModel ?? 'Unknown')) return false
    if (f.currencies.length && !f.currencies.includes(t.currency ?? 'Unknown')) return false
    if (range.start && t.month < range.start) return false
    if (range.end && t.month > range.end) return false
    return true
  })
}

export function dimensionValues(txs: Transaction[], dim: DimKey): string[] {
  return [...new Set(txs.map((t) => (t[dim] ?? 'Unknown') as string))].sort()
}

export type OverviewModel = {
  month: string
  mrr: number
  arr: number
  arpa: number | null
  activeCustomers: number
  logoChurn: number | null
  avgLifetime: number | null
}

export function overviewModel(txs: Transaction[], controls: Controls): OverviewModel {
  const m = buildMatrix(txs, controls.mode)
  const month = m.months[m.months.length - 1] ?? ''
  const prev = addMonths(month, -1)
  const churn = logoChurnRate(m, prev, month)
  return {
    month,
    mrr: mrrOf(m, month),
    arr: arr(m, month),
    arpa: arpa(m, month),
    activeCustomers: activeCustomers(m, month),
    logoChurn: churn,
    avgLifetime: churn != null ? avgLifetimeMonths(churn) : null,
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/lib/dashboard.test.ts` → PASS (5 tests). Then `npx vitest run` → all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/format.ts src/lib/dashboard.ts src/lib/dashboard.test.ts
git commit -m "feat(ui): pure dashboard model (filters + overview) + formatters"
```

---

## Task 3: App state context + reducer

**Files:** Create `src/state/AppContext.tsx`

Holds the whole session. `transactions === null` ⇒ show the upload gate.

- [ ] **Step 1: `src/state/AppContext.tsx`**

```tsx
'use client'
import { createContext, useContext, useMemo, useReducer } from 'react'
import type { Transaction, Controls, BinDef, MrrMode } from '@/src/lib/types'
import { DEFAULT_BINS } from '@/src/lib/types'
import type { Mapping } from '@/src/lib/mapping'
import type { FxRates } from '@/src/lib/fx'
import type { DataIssue } from '@/src/lib/normalize'
import type { Filters, DateRange } from '@/src/lib/dashboard'
import type { ParsedFile } from '@/src/lib/parse'

export type ViewId = 'overview' | 'growth' | 'cohorts' | 'segments' | 'customers' | 'bins'

type State = {
  parsed: ParsedFile | null
  mapping: Mapping | null
  fxRates: FxRates
  transactions: Transaction[] | null
  issues: DataIssue[]
  controls: Controls
  filters: Filters
  range: DateRange
  bins: BinDef[]
  view: ViewId
}

const DEFAULT_CONTROLS: Controls = {
  mode: 'activity', includeRefunds: true, reactivationGapK: 1,
  dormancyDays: 90, atRiskStreak: 3, grossMargin: 0.8,
}

const initial: State = {
  parsed: null, mapping: null, fxRates: {}, transactions: null, issues: [],
  controls: DEFAULT_CONTROLS, filters: { regions: [], businessModels: [], currencies: [] },
  range: { start: null, end: null }, bins: DEFAULT_BINS, view: 'overview',
}

type Action =
  | { type: 'setParsed'; parsed: ParsedFile; mapping: Mapping }
  | { type: 'setMapping'; mapping: Mapping }
  | { type: 'setFx'; fxRates: FxRates }
  | { type: 'setData'; transactions: Transaction[]; issues: DataIssue[] }
  | { type: 'setControls'; controls: Partial<Controls> }
  | { type: 'setFilters'; filters: Partial<Filters> }
  | { type: 'setRange'; range: DateRange }
  | { type: 'setBins'; bins: BinDef[] }
  | { type: 'setView'; view: ViewId }
  | { type: 'reset' }

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'setParsed': return { ...s, parsed: a.parsed, mapping: a.mapping }
    case 'setMapping': return { ...s, mapping: a.mapping }
    case 'setFx': return { ...s, fxRates: a.fxRates }
    case 'setData': return { ...s, transactions: a.transactions, issues: a.issues }
    case 'setControls': return { ...s, controls: { ...s.controls, ...a.controls } }
    case 'setFilters': return { ...s, filters: { ...s.filters, ...a.filters } }
    case 'setRange': return { ...s, range: a.range }
    case 'setBins': return { ...s, bins: a.bins }
    case 'setView': return { ...s, view: a.view }
    case 'reset': return initial
  }
}

const Ctx = createContext<{ state: State; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp must be used within AppProvider')
  return c
}
```

- [ ] **Step 2: Add the `@/*` path alias to `tsconfig.json`** (merge into compilerOptions)

```json
"baseUrl": ".",
"paths": { "@/*": ["./*"] }
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/state/AppContext.tsx tsconfig.json
git commit -m "feat(ui): app state context + reducer"
```

---

## Task 4: Upload gate — Dropzone, MappingForm, FxForm, DataIssues

**Files:** Create `src/components/upload/{Dropzone,MappingForm,FxForm,DataIssues}.tsx`

Flow inside `Dropzone`: pick file → `parseFile` → `autoDetect` → render `MappingForm`; when required fields mapped and (if multi-currency) FX rates entered, "Analyze" runs `normalize` and dispatches `setData`.

- [ ] **Step 1: `src/components/upload/MappingForm.tsx`**

```tsx
'use client'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import { REQUIRED_FIELDS } from '@/src/lib/mapping'

const FIELDS: { field: ColumnField; label: string }[] = [
  { field: 'date', label: 'Date *' }, { field: 'customerId', label: 'Customer ID *' },
  { field: 'amount', label: 'Overall Revenue *' }, { field: 'paymentId', label: 'Payment ID' },
  { field: 'invoiceNumber', label: 'Invoice Number' }, { field: 'name', label: 'Name' },
  { field: 'country', label: 'Country' }, { field: 'region', label: 'Region' },
  { field: 'businessModel', label: 'Business Model' }, { field: 'currency', label: 'Currency' },
  { field: 'customerFlag', label: 'Customer Flag' }, { field: 'refundFlag', label: 'Refund Flag' },
]

export function MappingForm({ headers, mapping, onChange }: {
  headers: string[]; mapping: Mapping; onChange: (m: Mapping) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {FIELDS.map(({ field, label }) => (
        <label key={field} className="flex flex-col text-sm">
          <span className={REQUIRED_FIELDS.includes(field) ? 'font-semibold' : ''}>{label}</span>
          <select
            className="mt-1 rounded border border-slate-300 bg-white p-2"
            value={mapping[field] ?? ''}
            onChange={(e) => onChange({ ...mapping, [field]: e.target.value || null })}
          >
            <option value="">— none —</option>
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `src/components/upload/FxForm.tsx`**

```tsx
'use client'
import type { FxRates } from '@/src/lib/fx'

export function FxForm({ currencies, base, rates, onBase, onRate }: {
  currencies: string[]; base: string; rates: FxRates
  onBase: (c: string) => void; onRate: (c: string, r: number) => void
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Base currency</span>
        <select className="rounded border border-slate-300 bg-white p-2" value={base} onChange={(e) => onBase(e.target.value)}>
          {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {currencies.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <span className="w-14">{c} →</span>
            <input type="number" step="0.0001" className="w-24 rounded border border-slate-300 p-1"
              value={c === base ? 1 : rates[c] ?? ''} disabled={c === base}
              onChange={(e) => onRate(c, Number(e.target.value))} />
          </label>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `src/components/upload/DataIssues.tsx`**

```tsx
'use client'
import type { DataIssue } from '@/src/lib/normalize'

export function DataIssues({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return null
  return (
    <details className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-800">{issues.length} rows skipped (data issues)</summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
        {issues.slice(0, 100).map((i, k) => <li key={k} className="text-amber-900">Row {i.rowIndex + 1}: {i.reason}</li>)}
      </ul>
    </details>
  )
}
```

- [ ] **Step 4: `src/components/upload/Dropzone.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
import { useApp } from '@/src/state/AppContext'
import { MappingForm } from './MappingForm'
import { FxForm } from './FxForm'

export function Dropzone() {
  const { state, dispatch } = useApp()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [base, setBase] = useState('')
  const [rates, setRates] = useState<FxRates>({})
  const [error, setError] = useState('')

  async function onFile(file: File) {
    try {
      const p = await parseFile(file)
      const m = autoDetect(p.headers)
      setParsed(p); setMapping(m)
      const curCol = m.currency
      const curs = curCol ? detectCurrencies(p.rows.map((r) => r[curCol])) : []
      setCurrencies(curs); setBase(curs[0] ?? '')
      setRates(Object.fromEntries(curs.map((c) => [c, c === (curs[0] ?? '') ? 1 : 1])))
    } catch (e) { setError(String(e)) }
  }

  function analyze() {
    if (!parsed || !mapping) return
    const missing = missingRequired(mapping)
    if (missing.length) { setError(`Map required fields: ${missing.join(', ')}`); return }
    const effectiveRates: FxRates = currencies.length ? { ...rates, [base]: 1 } : {}
    const { transactions, issues } = normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds })
    if (!transactions.length) { setError('No valid rows after normalization — check mapping/FX.'); return }
    dispatch({ type: 'setMapping', mapping }); dispatch({ type: 'setFx', fxRates: effectiveRates })
    dispatch({ type: 'setData', transactions, issues })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">Upload revenue data</h1>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="block w-full rounded border-2 border-dashed border-slate-300 p-8 text-center" />
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {parsed && mapping && (
        <>
          <section><h2 className="mb-2 font-semibold">Map columns</h2>
            <MappingForm headers={parsed.headers} mapping={mapping} onChange={setMapping} /></section>
          {currencies.length > 1 && (
            <section><h2 className="mb-2 font-semibold">Currency conversion</h2>
              <FxForm currencies={currencies} base={base} rates={rates} onBase={setBase}
                onRate={(c, r) => setRates((x) => ({ ...x, [c]: r }))} /></section>
          )}
          <button onClick={analyze} className="rounded bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700">Analyze</button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors. (Full visual check happens in Task 13 once wired.)
```bash
git add src/components/upload && git commit -m "feat(ui): upload gate (dropzone, mapping, fx, data issues)"
```

---

## Task 5: Layout — Sidebar + ControlBar

**Files:** Create `src/components/layout/{Sidebar,ControlBar}.tsx`

- [ ] **Step 1: `src/components/layout/Sidebar.tsx`**

```tsx
'use client'
import { useApp, type ViewId } from '@/src/state/AppContext'

const ITEMS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'growth', label: 'Growth' },
  { id: 'cohorts', label: 'Cohorts' }, { id: 'segments', label: 'Segments' },
  { id: 'customers', label: 'Customers' }, { id: 'bins', label: 'Revenue Bins' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
      <div className="mb-3 px-2 text-sm font-bold text-indigo-700">SaaS Analytics</div>
      {ITEMS.map((it) => (
        <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
          className={`rounded px-3 py-2 text-left text-sm ${state.view === it.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100'}`}>
          {it.label}
        </button>
      ))}
      <button onClick={() => dispatch({ type: 'reset' })} className="mt-auto rounded px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100">↺ New upload</button>
    </nav>
  )
}
```

- [ ] **Step 2: `src/components/layout/ControlBar.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { MRR_MODES } from '@/src/lib/types'
import { monthRange } from '@/src/lib/types'
import { dimensionValues } from '@/src/lib/dashboard'

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
          onChange={(e) => dispatch({ type: 'setControls', controls: { mode: e.target.value as any } })}>
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
```

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/layout && git commit -m "feat(ui): sidebar + sticky control bar"
```

---

## Task 6: UI primitives — KpiCard, TrendChart, BarsChart, Heatmap, DataTable, Callout

**Files:** Create `src/components/ui/{KpiCard,TrendChart,BarsChart,Heatmap,DataTable,Callout}.tsx`

- [ ] **Step 1: `KpiCard.tsx`**

```tsx
export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  )
}
```

- [ ] **Step 2: `Callout.tsx`** (for proxy/N-A honesty labels)

```tsx
export function Callout({ children }: { children: React.ReactNode }) {
  return <p className="rounded bg-slate-100 p-2 text-xs text-slate-500">{children}</p>
}
```

- [ ] **Step 3: `TrendChart.tsx`** (line; one or more series)

```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function TrendChart({ data, xKey, series }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]
}) {
  return (
    <div className="h-72 w-full rounded-lg border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey={xKey} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} dot={false} strokeWidth={2} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: `BarsChart.tsx`** (bar; supports stacked)

```tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function BarsChart({ data, xKey, series, stacked }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]; stacked?: boolean
}) {
  return (
    <div className="h-72 w-full rounded-lg border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey={xKey} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color} stackId={stacked ? 'a' : undefined} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 5: `Heatmap.tsx`** (cohort triangle: rows of numbers 0..1 → colored cells)

```tsx
export function Heatmap({ rows }: { rows: { label: string; size: number; values: (number | null)[] }[] }) {
  const maxLen = Math.max(0, ...rows.map((r) => r.values.length))
  const bg = (v: number | null) => v == null ? '#f8fafc' : `hsl(222 70% ${92 - Math.min(1, v) * 45}%)`
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3">
      <table className="text-xs">
        <thead><tr><th className="p-1 text-left">Cohort</th><th className="p-1">Size</th>
          {Array.from({ length: maxLen }, (_, i) => <th key={i} className="p-1">M{i}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="whitespace-nowrap p-1 font-medium">{r.label}</td>
              <td className="p-1 text-center text-slate-500">{r.size}</td>
              {r.values.map((v, i) => (
                <td key={i} className="p-1 text-center" style={{ background: bg(v) }}>
                  {v == null ? '' : `${Math.round(v * 100)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 6: `DataTable.tsx`** (generic column-config table)

```tsx
export type Column<T> = { key: string; header: string; render: (row: T) => React.ReactNode; align?: 'right' | 'left' }
export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((c) => <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/ui && git commit -m "feat(ui): chart + table primitives"
```

---

## Task 7: Overview view

**Files:** Create `src/components/views/Overview.tsx`

Uses filtered transactions from context. KPI grid + monthly MRR trend.

- [ ] **Step 1: `src/components/views/Overview.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters, overviewModel } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf } from '@/src/lib/engine'
import { arpa } from '@/src/lib/engine'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'

export function Overview() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const model = useMemo(() => overviewModel(txs, state.controls), [txs, state.controls])
  const trend = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return m.months.map((mo) => ({ month: mo, MRR: Math.round(mrrOf(m, mo)), ARPA: Math.round(arpa(m, mo) ?? 0) }))
  }, [txs, state.controls])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Overview — {model.month || 'no data'}</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="MRR" value={fmtMoney(model.mrr)} />
        <KpiCard label="ARR" value={fmtMoney(model.arr)} />
        <KpiCard label="ARPA" value={fmtMoney(model.arpa)} />
        <KpiCard label="Active customers" value={fmtNum(model.activeCustomers)} />
        <KpiCard label="Logo churn (MoM)" value={fmtPct(model.logoChurn)} />
        <KpiCard label="Avg lifetime" value={model.avgLifetime == null ? '—' : `${model.avgLifetime.toFixed(1)} mo`} />
      </div>
      <TrendChart data={trend} xKey="month" series={[{ key: 'MRR', color: '#4f46e5' }, { key: 'ARPA', color: '#0891b2' }]} />
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Overview.tsx && git commit -m "feat(ui): overview view"
```

---

## Task 8: Growth view

**Files:** Create `src/components/views/Growth.tsx`

MRR movement (stacked bars: expansion/reactivation/new up, contraction/churn down) + net-new line.

- [ ] **Step 1: `src/components/views/Growth.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, movementSeries } from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { TrendChart } from '@/src/components/ui/TrendChart'

export function Growth() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const data = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }).map((s) => ({
      month: s.month, New: Math.round(s.newMrr), Expansion: Math.round(s.expansion),
      Reactivation: Math.round(s.reactivation), Contraction: -Math.round(s.contraction),
      Churn: -Math.round(s.churn), 'Net new': Math.round(s.netNew),
    }))
  }, [txs, state.controls])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Growth — MRR movement</h1>
      <BarsChart data={data} xKey="month" stacked series={[
        { key: 'New', color: '#22c55e' }, { key: 'Expansion', color: '#16a34a' },
        { key: 'Reactivation', color: '#84cc16' }, { key: 'Contraction', color: '#f59e0b' },
        { key: 'Churn', color: '#ef4444' },
      ]} />
      <TrendChart data={data} xKey="month" series={[{ key: 'Net new', color: '#4f46e5' }]} />
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Growth.tsx && git commit -m "feat(ui): growth / MRR movement view"
```

---

## Task 9: Cohorts view

**Files:** Create `src/components/views/Cohorts.tsx`

Two heatmaps: net dollar retention and logo survival.

- [ ] **Step 1: `src/components/views/Cohorts.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Cohorts.tsx && git commit -m "feat(ui): cohorts view (retention + survival heatmaps)"
```

---

## Task 10: Segments view

**Files:** Create `src/components/views/Segments.tsx`

Revenue by region / business model / currency (bar), + concentration KPIs (HHI, top-1/5/10 share).

- [ ] **Step 1: `src/components/views/Segments.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { revenueByDimension, hhi, topNShare } from '@/src/lib/engine'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { fmtPct, fmtNum } from '@/src/lib/format'

export function Segments() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const region = useMemo(() => revenueByDimension(txs, 'region').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])
  const model = useMemo(() => revenueByDimension(txs, 'businessModel').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])
  const currency = useMemo(() => revenueByDimension(txs, 'currency').map((r) => ({ key: r.key, Revenue: Math.round(r.revenue) })), [txs])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Segments</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Customer HHI" value={fmtNum(Math.round(hhi(txs)))} hint="0–10,000; >2500 concentrated" />
        <KpiCard label="Top-1 share" value={fmtPct(topNShare(txs, 1))} />
        <KpiCard label="Top-5 share" value={fmtPct(topNShare(txs, 5))} />
        <KpiCard label="Top-10 share" value={fmtPct(topNShare(txs, 10))} />
      </div>
      <section><h2 className="mb-1 font-semibold">Revenue by region</h2>
        <BarsChart data={region} xKey="key" series={[{ key: 'Revenue', color: '#4f46e5' }]} /></section>
      <section><h2 className="mb-1 font-semibold">Revenue by business model</h2>
        <BarsChart data={model} xKey="key" series={[{ key: 'Revenue', color: '#0891b2' }]} /></section>
      <section><h2 className="mb-1 font-semibold">Revenue by currency</h2>
        <BarsChart data={currency} xKey="key" series={[{ key: 'Revenue', color: '#7c3aed' }]} /></section>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Segments.tsx && git commit -m "feat(ui): segments view (by dimension + concentration)"
```

---

## Task 11: Customers view

**Files:** Create `src/components/views/Customers.tsx`

Top customers table + at-risk / dormant flags.

- [ ] **Step 1: `src/components/views/Customers.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, topCustomers, atRisk, perCustomerRefundRate } from '@/src/lib/engine'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { fmtMoney, fmtPct } from '@/src/lib/format'

type Row = { customerId: string; name: string | null; revenue: number; share: number; atRisk: boolean; refundRate: number | null }

export function Customers() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const rows = useMemo<Row[]>(() => {
    const m = buildMatrix(txs, state.controls.mode)
    return topCustomers(txs, 25).map((t) => ({
      customerId: t.customerId, name: t.name, revenue: t.revenue, share: t.share,
      atRisk: atRisk(m, t.customerId, state.controls.atRiskStreak),
      refundRate: perCustomerRefundRate(txs, t.customerId),
    }))
  }, [txs, state.controls])

  const cols: Column<Row>[] = [
    { key: 'name', header: 'Customer', render: (r) => r.name ?? r.customerId },
    { key: 'revenue', header: 'Revenue', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: 'Share', align: 'right', render: (r) => fmtPct(r.share) },
    { key: 'refund', header: 'Refund rate', align: 'right', render: (r) => fmtPct(r.refundRate) },
    { key: 'flag', header: 'Status', render: (r) => r.atRisk ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">at risk</span> : <span className="text-xs text-slate-400">ok</span> },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Top customers</h1>
      <DataTable columns={cols} rows={rows} />
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Customers.tsx && git commit -m "feat(ui): customers view (top-N + at-risk/refund flags)"
```

---

## Task 12: Bins view (dynamic bin editor)

**Files:** Create `src/components/views/Bins.tsx`

Editable bins + a selected-month table (contribution, avg MRR, avg ACV, #customers) + month-wise stacked contribution.

- [ ] **Step 1: `src/components/views/Bins.tsx`**

```tsx
'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, binAnalysis, binSeries } from '@/src/lib/engine'
import type { BinDef } from '@/src/lib/types'
import { DataTable, type Column } from '@/src/components/ui/DataTable'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'
import type { BinRow } from '@/src/lib/engine'

export function Bins() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range), [state.transactions, state.filters, state.range])
  const matrix = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls])
  const [month, setMonth] = useState('')
  const activeMonth = month || matrix.months[matrix.months.length - 1] || ''

  const result = useMemo(() => activeMonth ? binAnalysis(matrix, activeMonth, state.bins) : null, [matrix, activeMonth, state.bins])
  const trend = useMemo(() => binSeries(matrix, state.bins).map((r) => {
    const row: Record<string, any> = { month: r.month }
    r.bins.forEach((b) => { row[b.label] = Math.round(b.revenue) })
    return row
  }), [matrix, state.bins])

  function editBin(i: number, patch: Partial<BinDef>) {
    dispatch({ type: 'setBins', bins: state.bins.map((b, k) => (k === i ? { ...b, ...patch } : b)) })
  }
  function addBin() { dispatch({ type: 'setBins', bins: [...state.bins, { label: 'New bin', min: 0, max: null }] }) }
  function removeBin(i: number) { dispatch({ type: 'setBins', bins: state.bins.filter((_, k) => k !== i) }) }

  const cols: Column<BinRow>[] = [
    { key: 'label', header: 'Bin', render: (r) => r.label },
    { key: 'customers', header: '# Customers', align: 'right', render: (r) => fmtNum(r.customers) },
    { key: 'revenue', header: 'Contribution', align: 'right', render: (r) => fmtMoney(r.revenue) },
    { key: 'share', header: '% of Revenue', align: 'right', render: (r) => fmtPct(r.share) },
    { key: 'avgMrr', header: 'Avg MRR', align: 'right', render: (r) => fmtMoney(r.avgMrr) },
    { key: 'avgAcv', header: 'Avg ACV', align: 'right', render: (r) => fmtMoney(r.avgAcv) },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Revenue bins</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-sm font-semibold">Bin thresholds (min &lt; value ≤ max; blank max = open top)</div>
        <div className="space-y-1">
          {state.bins.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input className="w-40 rounded border p-1" value={b.label} onChange={(e) => editBin(i, { label: e.target.value })} />
              <input type="number" className="w-24 rounded border p-1" value={Number.isFinite(b.min) ? b.min : ''} placeholder="-∞"
                onChange={(e) => editBin(i, { min: e.target.value === '' ? -Infinity : Number(e.target.value) })} />
              <span>→</span>
              <input type="number" className="w-24 rounded border p-1" value={b.max ?? ''} placeholder="∞"
                onChange={(e) => editBin(i, { max: e.target.value === '' ? null : Number(e.target.value) })} />
              <button onClick={() => removeBin(i)} className="text-red-500">✕</button>
            </div>
          ))}
        </div>
        <button onClick={addBin} className="mt-2 rounded bg-slate-100 px-3 py-1 text-sm">+ Add bin</button>
      </section>

      <label className="text-sm">Month
        <select className="ml-2 rounded border p-1" value={activeMonth} onChange={(e) => setMonth(e.target.value)}>
          {matrix.months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      {result && <DataTable columns={cols} rows={result.bins} />}

      <section><h2 className="mb-1 font-semibold">Contribution by bin over time</h2>
        <BarsChart data={trend} xKey="month" stacked series={state.bins.map((b, i) => ({ key: b.label, color: ['#4f46e5', '#0891b2', '#7c3aed', '#f59e0b', '#ef4444', '#22c55e'][i % 6] }))} /></section>
    </div>
  )
}
```

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit` → 0 errors.
```bash
git add src/components/views/Bins.tsx && git commit -m "feat(ui): bins view with dynamic bin editor"
```

---

## Task 13: Wire the Shell + page; empty states; build

**Files:** Create `src/components/Shell.tsx`; rewrite `app/page.tsx`

- [ ] **Step 1: `src/components/Shell.tsx`**

```tsx
'use client'
import { useApp } from '@/src/state/AppContext'
import { Dropzone } from '@/src/components/upload/Dropzone'
import { DataIssues } from '@/src/components/upload/DataIssues'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { ControlBar } from '@/src/components/layout/ControlBar'
import { Overview } from '@/src/components/views/Overview'
import { Growth } from '@/src/components/views/Growth'
import { Cohorts } from '@/src/components/views/Cohorts'
import { Segments } from '@/src/components/views/Segments'
import { Customers } from '@/src/components/views/Customers'
import { Bins } from '@/src/components/views/Bins'

export function Shell() {
  const { state } = useApp()
  if (!state.transactions) return <Dropzone />
  const view = {
    overview: <Overview />, growth: <Growth />, cohorts: <Cohorts />,
    segments: <Segments />, customers: <Customers />, bins: <Bins />,
  }[state.view]
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <ControlBar />
        <main className="space-y-4 p-5">
          {state.issues.length > 0 && <DataIssues issues={state.issues} />}
          {view}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `app/page.tsx`**

```tsx
'use client'
import { AppProvider } from '@/src/state/AppContext'
import { Shell } from '@/src/components/Shell'
export default function Page() {
  return <AppProvider><Shell /></AppProvider>
}
```

- [ ] **Step 3: Build + smoke test with a real CSV**

Run: `npm run build` → success (no type errors, all pages compile).
Then `npm run dev`; create `sample.csv`:
```
Payment ID,Invoice Number,Date,customer_id,Name,Country,Business Model,Currency,Overall Revenue,Customer Flag,Refund Flag,Region
p1,i1,2026-01-05,c1,Acme,US,subscription,USD,100,new,false,NA
p2,i2,2026-02-05,c1,Acme,US,subscription,USD,150,repeat,false,NA
p3,i3,2026-01-06,c2,Globex,DE,subscription,EUR,200,new,false,EU
p4,i4,2026-03-06,c2,Globex,DE,subscription,EUR,200,repeat,false,EU
p5,i5,2026-02-07,c3,Initech,US,onetime,USD,3000,new,false,NA
p6,i6,2026-02-08,c3,Initech,US,onetime,USD,-40,repeat,true,NA
```
Upload it: verify mapping auto-fills, FX form appears (USD/EUR), setting EUR rate → Analyze → Overview KPIs render, all 6 views switch, filters + MRR-mode toggle recompute, bin editor edits recompute.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(ui): wire shell, views, upload gate; full app builds"
```

---

## Self-Review notes (coverage vs spec)

- Upload → map → FX → normalize wired (T4, T13) with Data Issues surfaced. ✓ (spec §4, §9)
- Global controls: MRR mode, refunds, date range, region/model filters (T5); bin config (T12). ✓ (spec §5.1)
- 7 views present: Upload gate + Overview/Growth/Cohorts/Segments/Customers/Bins (T7–T13). ✓ (spec §8)
- Bins fully dynamic: add/remove/edit thresholds+labels, live recompute, per-bin #customers/contribution/avgMRR/avgACV, month-wise trend (T12). ✓ (spec §7)
- Honesty: `fmtX(null) => '—'`, proxy callouts (T6 Callout). Remaining N/A metrics (Rule-of-40 profit half etc.) render as '—' with a Callout when added. ✓ (spec §6.7, §9)
- Pure data-shaping isolated in `dashboard.ts` and unit-tested (T2); components stay thin. ✓
- Deploys to Vercel: standard Next.js App Router, no server code. ✓ (spec §3)
- Deferred to fast-follow (unchanged from spec §12): currency/country finer splits, RFM, Pareto/Gini/whale curve, refund-timing detail, cohort payback, health score, seasonality, T2D3, `nice`/`stretch` metrics — each is a formula in the catalog and an added card/section on these same views.
```
