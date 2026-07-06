# Data Issues Fix Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fix, remove, fill, or ignore bad rows in an uploaded payments file — both before analyzing (Validate step) and later from a dedicated dashboard tab — instead of only being able to switch a global date-format dropdown.

**Architecture:** Extend the existing `DataIssue` type into a discriminated `Issue` union covering blocking problems (bad date/amount/currency/missing customer ID — row excluded from `transactions` until fixed) and non-blocking warnings (blank optional fields, duplicate IDs, duplicate rows — row already counted, flagged for cleanup). One `normalizeRow()` function is the single source of truth for per-row validation, called by both the bulk `normalize()` loop and the new fix-retry path. One `IssueFixer` UI component is reused in the pre-Analyze Validate step (local component state) and the new post-Analyze "Data Issues" tab (global `AppContext` dispatch).

**Tech Stack:** Next.js + React + TypeScript, Tailwind, Vitest. No new dependencies.

**Design doc:** `docs/data-issues-pipeline.md` (Understanding Summary, Assumptions, Decision Log — read first for the *why* behind these tasks).

---

## Before you start

Run the full test suite once to confirm a clean baseline:

```bash
npx vitest run
```

Expected: all existing tests pass (103 passed at time of writing).

---

### Task 1: Extend `normalize.ts` — Issue types, `normalizeRow`, customer-ID check, row overrides

**Files:**
- Modify: `src/lib/normalize.ts` (full file)
- Modify: `src/lib/normalize.test.ts` (append tests)

This is the foundation every other task builds on. It:
1. Introduces the `Issue` discriminated union (`BlockingIssue` replaces the shape of today's `DataIssue`, plus three new non-blocking kinds used later by `findWarnings` in Task 2).
2. Extracts per-row validation into `normalizeRow()` so a single fix can be re-validated without re-running the whole file.
3. Adds a new blocking check: missing customer ID (today it silently defaults to `''`).
4. Adds optional row-level overrides to `normalize()` (edited raw values, per-row date-order overrides, removed rows) — needed by Task 5's live pre-Analyze fixer. The 5th parameter is optional so all 4-arg call sites (existing tests, existing callers) keep working unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/normalize.test.ts` (keep the existing `import`/`mapping`/`row` and all existing `it(...)` blocks untouched, add these inside the existing `describe('normalize', ...)` block, plus a new import):

```ts
import { describe, it, expect } from 'vitest'
import { normalize, normalizeRow } from './normalize'
import type { Mapping } from './mapping'
```

Add these `it` blocks at the end of the existing `describe('normalize', ...)`:

```ts
  it('quarantines rows with a missing customer id', () => {
    const { issues } = normalize([row({ cid: '' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues[0].reason).toMatch(/customer/i)
  })
  it('normalizeRow agrees with normalize for the same row', () => {
    const { issues } = normalize([row({ Date: 'nope' })], mapping, { USD: 1 }, { includeRefunds: true })
    const direct = normalizeRow(row({ Date: 'nope' }), 0, mapping, { USD: 1 }, { includeRefunds: true, dateOrder: 'mdy' })
    expect('issue' in direct && direct.issue.reason).toBe(issues[0].reason)
  })
  it('applies row overrides on top of the parsed data', () => {
    const rows = [row({ Date: 'nope' }), row({})]
    const { transactions, issues, total } = normalize(rows, mapping, { USD: 1 }, { includeRefunds: true }, {
      overrides: { 0: { Date: '2026-02-01' } },
    })
    expect(issues).toHaveLength(0)
    expect(transactions).toHaveLength(2)
    expect(total).toBe(2)
  })
  it('excludes removed rows from both transactions and issues, but keeps the original total', () => {
    const rows = [row({ Date: 'nope' }), row({})]
    const { transactions, issues, total } = normalize(rows, mapping, { USD: 1 }, { includeRefunds: true }, {
      removed: new Set([0]),
    })
    expect(issues).toHaveLength(0)
    expect(transactions).toHaveLength(1)
    expect(total).toBe(2)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/normalize.test.ts`
Expected: FAIL — `normalizeRow` is not exported, missing-customer-id row currently succeeds instead of erroring, 5th-argument overrides don't exist yet.

- [ ] **Step 3: Replace `src/lib/normalize.ts` with the full new implementation**

```ts
import type { Mapping, ColumnField } from './mapping'
import type { Transaction } from './types'
import { monthKey } from './types'
import { convert, type FxRates } from './fx'
import { parseDate, detectDateOrder, type DateOrder } from './date'

type IssueBase = { id: string; reason: string }

export type BlockingIssue = IssueBase & {
  blocking: true
  rowIndex: number
  kind: 'date' | 'amount' | 'currency' | 'customerId'
  field: ColumnField
  raw: Record<string, string>
}

export type BlankFieldIssue = IssueBase & {
  blocking: false
  kind: 'blank'
  field: 'invoiceNumber' | 'name' | 'country' | 'region' | 'businessModel'
  paymentId: string
}

export type DuplicateIdIssue = IssueBase & {
  blocking: false
  kind: 'duplicateId'
  field: 'paymentId' | 'invoiceNumber'
  paymentIds: string[]
}

export type DuplicateRowIssue = IssueBase & {
  blocking: false
  kind: 'duplicateRow'
  paymentIds: string[]
}

export type Issue = BlockingIssue | BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue

export type NormalizeOpts = { includeRefunds: boolean; dateOrder?: DateOrder }
export type RowFixes = {
  overrides?: Record<number, Record<string, string>>   // rowIndex -> {columnHeader: newRawValue}
  dateOrders?: Record<number, Exclude<DateOrder, 'auto'>> // rowIndex -> order override, for re-parsing just this row
  removed?: Set<number>                                  // rowIndexes to exclude entirely
}
export type NormalizeResult = { transactions: Transaction[]; issues: BlockingIssue[]; resolvedDateOrder: Exclude<DateOrder, 'auto'>; total: number }

const TRUE = new Set(['true', '1', 'yes', 'y', 't', 'refund', 'refunded'])

function get(row: Record<string, string>, col: string | null): string | null {
  if (!col) return null
  const v = row[col]
  return v == null ? null : String(v).trim()
}

/** Handles currency symbols, thousands separators, and parenthesised negatives, e.g. "($1,250.00)" → -1250. */
function parseAmount(s: string): number | null {
  let t = s.trim()
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (/-/.test(t)) neg = true
  t = t.replace(/[^0-9.]/g, '') // strip currency symbols, commas, spaces, letters
  if (t === '' || isNaN(Number(t))) return null
  const n = Number(t)
  return neg ? -Math.abs(n) : n
}

/** Validate + build one row. Pure — reused by the bulk `normalize()` loop and by single-row re-fix in the issue pipeline. */
export function normalizeRow(
  raw: Record<string, string>,
  rowIndex: number,
  mapping: Mapping,
  rates: FxRates,
  opts: { includeRefunds: boolean; dateOrder: Exclude<DateOrder, 'auto'> },
): { transaction: Transaction } | { issue: BlockingIssue } {
  const id = `row:${rowIndex}`
  const dateStr = get(raw, mapping.date)
  const d = parseDate(dateStr, opts.dateOrder)
  if (!d || isNaN(d.getTime())) {
    return { issue: { id, blocking: true, rowIndex, kind: 'date', field: 'date', reason: `Unparseable date: "${dateStr ?? ''}"`, raw } }
  }
  const amtStr = get(raw, mapping.amount) ?? ''
  const amt = parseAmount(amtStr)
  if (amt === null) {
    return { issue: { id, blocking: true, rowIndex, kind: 'amount', field: 'amount', reason: `Non-numeric amount: "${amtStr}"`, raw } }
  }
  const currency = get(raw, mapping.currency)
  const base = convert(Math.abs(amt), currency, rates)
  if (base === null) {
    return { issue: { id, blocking: true, rowIndex, kind: 'currency', field: 'currency', reason: `Unknown currency: "${currency ?? ''}" (add an FX rate)`, raw } }
  }
  const customerId = get(raw, mapping.customerId)
  if (!customerId) {
    return { issue: { id, blocking: true, rowIndex, kind: 'customerId', field: 'customerId', reason: 'Missing customer ID', raw } }
  }
  const refundFlag = (get(raw, mapping.refundFlag) ?? '').toLowerCase()
  const isRefund = TRUE.has(refundFlag) || amt < 0

  return {
    transaction: {
      paymentId: get(raw, mapping.paymentId) ?? String(rowIndex),
      invoiceNumber: get(raw, mapping.invoiceNumber),
      date: d,
      month: monthKey(d),
      customerId,
      name: get(raw, mapping.name),
      country: get(raw, mapping.country),
      region: get(raw, mapping.region),
      businessModel: get(raw, mapping.businessModel),
      currency,
      amountNative: amt,
      amountBase: isRefund ? -Math.abs(base) : Math.abs(base),
      isRefund,
    },
  }
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  rates: FxRates,
  opts: NormalizeOpts,
  fixes?: RowFixes,
): NormalizeResult {
  const transactions: Transaction[] = []
  const issues: BlockingIssue[] = []
  const resolvedDateOrder = !opts.dateOrder || opts.dateOrder === 'auto'
    ? detectDateOrder(rows.map((r) => get(r, mapping.date)))
    : opts.dateOrder
  const overrides = fixes?.overrides ?? {}
  const dateOrders = fixes?.dateOrders ?? {}
  const removed = fixes?.removed ?? new Set<number>()

  rows.forEach((raw, i) => {
    if (removed.has(i)) return
    const patchedRaw = overrides[i] ? { ...raw, ...overrides[i] } : raw
    const order = dateOrders[i] ?? resolvedDateOrder
    const result = normalizeRow(patchedRaw, i, mapping, rates, { includeRefunds: opts.includeRefunds, dateOrder: order })
    if ('issue' in result) { issues.push(result.issue); return }
    if (result.transaction.isRefund && !opts.includeRefunds) return // gross view: ignore refunds
    transactions.push(result.transaction)
  })

  return { transactions, issues, resolvedDateOrder, total: rows.length }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/normalize.test.ts`
Expected: PASS — all 9 tests (5 existing + 4 new).

- [ ] **Step 5: Fix downstream type errors from the `DataIssue` rename**

`DataIssue` no longer exists as a type name — it's been replaced by `BlockingIssue`. Run the type checker to find every call site:

Run: `npx tsc --noEmit`
Expected: errors in `src/state/AppContext.tsx`, `src/components/upload/IssueSummary.tsx`, `src/components/upload/DataIssues.tsx`, `src/lib/issues.ts` — these are fixed in Tasks 2–8. This step is just to confirm the exact list before continuing; no fix here.

- [ ] **Step 6: Commit**

```bash
git add src/lib/normalize.ts src/lib/normalize.test.ts
git commit -m "feat: extract normalizeRow, add Issue union + customerId check + row overrides"
```

(This commit will not typecheck clean in isolation — that's expected and resolved by Task 8. If your workflow requires every commit to typecheck, squash Tasks 1–8 before pushing.)

---

### Task 2: `issues.ts` — kind-based categorization + `findWarnings`

**Files:**
- Modify: `src/lib/issues.ts` (full file)
- Create: `src/lib/issues.test.ts`

`summarizeIssues` currently groups by regex-matching the `reason` string. Now that every `Issue` carries a typed `kind`, switch to that — more robust, and works for the 3 new non-blocking kinds too. `IssueGroup` gains an `items` field so the UI (Task 4) can render individual rows, not just counts. `findWarnings` is the new post-hoc scan over already-valid `Transaction[]` for blank optional fields and duplicates.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/issues.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { findWarnings, summarizeIssues } from './issues'
import type { Transaction } from './types'

const txn = (o: Partial<Transaction>): Transaction => ({
  paymentId: 'p1', invoiceNumber: 'inv1', date: new Date('2026-01-01'), month: '2026-01',
  customerId: 'c1', name: 'Acme', country: 'US', region: 'NA', businessModel: 'sub',
  currency: 'USD', amountNative: 100, amountBase: 100, isRefund: false, ...o,
})

describe('findWarnings', () => {
  it('flags a blank optional field', () => {
    const warnings = findWarnings([txn({ country: null })])
    expect(warnings.some((w) => w.kind === 'blank' && w.field === 'country')).toBe(true)
  })
  it('does not flag a populated optional field', () => {
    const warnings = findWarnings([txn({})])
    expect(warnings.some((w) => w.kind === 'blank')).toBe(false)
  })
  it('flags duplicate payment IDs', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1' }), txn({ paymentId: 'p1' })])
    expect(warnings.some((w) => w.kind === 'duplicateId' && w.field === 'paymentId')).toBe(true)
  })
  it('does not flag a unique payment id', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1' }), txn({ paymentId: 'p2' })])
    expect(warnings.some((w) => w.kind === 'duplicateId')).toBe(false)
  })
  it('flags duplicate rows sharing customer, date, amount, currency', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1' }), txn({ paymentId: 'p2' })])
    expect(warnings.some((w) => w.kind === 'duplicateRow')).toBe(true)
  })
  it('does not flag rows with different amounts as duplicates', () => {
    const warnings = findWarnings([txn({ paymentId: 'p1', amountNative: 100 }), txn({ paymentId: 'p2', amountNative: 200 })])
    expect(warnings.some((w) => w.kind === 'duplicateRow')).toBe(false)
  })
})

describe('summarizeIssues', () => {
  it('groups blocking issues by category with an items list', () => {
    const groups = summarizeIssues([
      { id: 'row:0', blocking: true, rowIndex: 0, kind: 'date', field: 'date', reason: 'Unparseable date: "x"', raw: {} },
    ])
    expect(groups[0].category).toBe('Dates')
    expect(groups[0].items).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/issues.test.ts`
Expected: FAIL — `findWarnings` is not exported yet.

- [ ] **Step 3: Replace `src/lib/issues.ts` with the full new implementation**

```ts
import type { Issue, BlankFieldIssue, DuplicateIdIssue, DuplicateRowIssue } from './normalize'
import type { Transaction } from './types'

export type IssueGroup = { category: string; hint: string; count: number; examples: string[]; items: Issue[] }

const CATEGORY: Record<Issue['kind'], { category: string; hint: string }> = {
  date: { category: 'Dates', hint: 'Try a different date format below' },
  amount: { category: 'Amounts', hint: 'Check the mapped revenue column' },
  currency: { category: 'Currency', hint: 'Add an FX rate for this currency' },
  customerId: { category: 'Customer ID', hint: 'Fill in a customer ID or remove the row' },
  blank: { category: 'Missing details', hint: 'Fill in a value or ignore' },
  duplicateId: { category: 'Duplicate IDs', hint: 'Same invoice/payment number appears on multiple rows' },
  duplicateRow: { category: 'Duplicate rows', hint: 'Same customer, date, and amount appear on multiple rows' },
}

function exampleValue(issue: Issue): string | null {
  if (issue.kind === 'duplicateId' || issue.kind === 'duplicateRow') return issue.paymentIds.join(', ')
  if (issue.blocking) return issue.reason.match(/"([^"]*)"/)?.[1] ?? null
  return issue.reason
}

/** Group issues by category with counts + a few example values + the raw items (for the interactive fix UI). */
export function summarizeIssues(issues: Issue[]): IssueGroup[] {
  const map = new Map<string, { hint: string; count: number; examples: Set<string>; items: Issue[] }>()
  for (const it of issues) {
    const { category, hint } = CATEGORY[it.kind]
    const g = map.get(category) ?? { hint, count: 0, examples: new Set<string>(), items: [] }
    g.count++
    g.items.push(it)
    const val = exampleValue(it)
    if (val && g.examples.size < 5) g.examples.add(val)
    map.set(category, g)
  }
  return [...map.entries()]
    .map(([category, g]) => ({ category, hint: g.hint, count: g.count, examples: [...g.examples], items: g.items }))
    .sort((a, b) => b.count - a.count)
}

type OptionalTxnField = 'invoiceNumber' | 'name' | 'country' | 'region' | 'businessModel'
const OPTIONAL_FIELDS: OptionalTxnField[] = ['invoiceNumber', 'name', 'country', 'region', 'businessModel']

/** Scan already-valid transactions for non-blocking problems: blank optional fields and duplicates. Derived on demand — never persisted, so it can't go stale after an edit. */
export function findWarnings(transactions: Transaction[]): (BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue)[] {
  const warnings: (BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue)[] = []

  for (const field of OPTIONAL_FIELDS) {
    for (const t of transactions) {
      if (!t[field]) warnings.push({ id: `blank:${field}:${t.paymentId}`, blocking: false, kind: 'blank', field, paymentId: t.paymentId, reason: `Missing ${field}` })
    }
  }

  for (const field of ['paymentId', 'invoiceNumber'] as const) {
    const byValue = new Map<string, string[]>()
    for (const t of transactions) {
      const v = field === 'paymentId' ? t.paymentId : t.invoiceNumber
      if (!v) continue
      byValue.set(v, [...(byValue.get(v) ?? []), t.paymentId])
    }
    for (const [value, ids] of byValue) {
      if (ids.length > 1) warnings.push({ id: `dupId:${field}:${value}`, blocking: false, kind: 'duplicateId', field, paymentIds: ids, reason: `Duplicate ${field}: "${value}"` })
    }
  }

  const byRow = new Map<string, string[]>()
  for (const t of transactions) {
    const key = `${t.customerId}|${t.date.getTime()}|${t.amountNative}|${t.currency ?? ''}`
    byRow.set(key, [...(byRow.get(key) ?? []), t.paymentId])
  }
  for (const ids of byRow.values()) {
    if (ids.length > 1) warnings.push({ id: `dupRow:${ids.join(',')}`, blocking: false, kind: 'duplicateRow', paymentIds: ids, reason: `${ids.length} rows share the same customer, date, and amount` })
  }

  return warnings
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/issues.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/issues.ts src/lib/issues.test.ts
git commit -m "feat: kind-based issue categorization + findWarnings for blank/duplicate detection"
```

---

### Task 3: `AppContext.tsx` — state fields, actions, reducer, persistence

**Files:**
- Modify: `src/state/AppContext.tsx` (full file)

Adds `resolvedDateOrder` (needed so post-Analyze fixes re-parse dates the same way the original analyze did) and `dismissedWarningIds` (so an ignored warning doesn't resurface). Adds 5 new array-shaped reducer actions. No dedicated test file — this repo has no existing reducer/component tests (confirmed: `vitest.config.ts` only includes `src/**/*.test.ts`, and no `AppContext.test.ts` exists despite 9 prior action types); verified manually in Task 9 instead, consistent with the established pattern.

- [ ] **Step 1: Replace `src/state/AppContext.tsx` with the full new implementation**

```tsx
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
```

Note the persist effect's dependency array now includes `state.issues` and `state.dismissedWarningIds` — previously `issues` was persisted but NOT in the dependency list, a latent bug that never mattered because `issues` only ever changed together with `transactions` (via `setData`). The new `removeIssues`/`dismissWarnings` actions change `issues`/`dismissedWarningIds` alone, so this must be fixed now or fixes silently fail to survive a reload.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `IssueSummary.tsx`, `DataIssues.tsx` (upload), `Dropzone.tsx` — all resolved by Tasks 4–8.

- [ ] **Step 3: Commit**

```bash
git add src/state/AppContext.tsx
git commit -m "feat: add resolveIssues/removeIssues/patchTransactions/removeTransactions/dismissWarnings actions"
```

---

### Task 4: `IssueFixer` component

**Files:**
- Create: `src/components/upload/IssueFixer.tsx`
- Delete: `src/components/upload/IssueSummary.tsx` (fully superseded — its only two callers are migrated in Tasks 5 and 8)

No test file — this repo has no component test setup (`vitest.config.ts` only picks up `src/**/*.test.ts`, no `jsdom`/`@testing-library` dependency). Verified manually in Task 9, matching how every other component in this codebase is verified.

- [ ] **Step 1: Delete the superseded component**

```bash
git rm src/components/upload/IssueSummary.tsx
```

- [ ] **Step 2: Create `src/components/upload/IssueFixer.tsx`**

```tsx
'use client'
import { useMemo, useState } from 'react'
import type { Issue, BlockingIssue, DuplicateIdIssue, DuplicateRowIssue } from '@/src/lib/normalize'
import { summarizeIssues } from '@/src/lib/issues'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import type { DateOrder } from '@/src/lib/date'

const tint = (c: string) => `color-mix(in srgb, ${c} 13%, transparent)`
const DATE_OPTS: { v: Exclude<DateOrder, 'auto'>; label: string }[] = [
  { v: 'dmy', label: 'DD/MM/YYYY' }, { v: 'mdy', label: 'MM/DD/YYYY' }, { v: 'ymd', label: 'YYYY-MM-DD' },
]

const isDuplicate = (it: Issue): it is DuplicateIdIssue | DuplicateRowIssue => it.kind === 'duplicateId' || it.kind === 'duplicateRow'

function inputType(issue: Issue): 'date' | 'number' | 'text' {
  if (issue.blocking && issue.kind === 'date') return 'date'
  if (issue.blocking && issue.kind === 'amount') return 'number'
  return 'text'
}

function currentRawValue(issue: BlockingIssue, mapping: Mapping): string {
  const col = mapping[issue.field]
  return col ? issue.raw[col] ?? '' : ''
}

export type IssueFixerProps = {
  issues: Issue[]
  mapping: Mapping
  onFix: (ids: string[], patch: Partial<Record<ColumnField, string>>, dateOrder?: Exclude<DateOrder, 'auto'>) => void
  onRemove: (ids: string[]) => void
  onRemoveMember?: (paymentId: string) => void
  onDismiss?: (ids: string[]) => void
}

/** Interactive fix/remove/fill panel for validation issues. Reused pre-Analyze (local state) and post-Analyze (dispatch). */
export function IssueFixer({ issues, mapping, onFix, onRemove, onRemoveMember, onDismiss }: IssueFixerProps) {
  const groups = useMemo(() => summarizeIssues(issues), [issues])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [bulkValue, setBulkValue] = useState('')

  if (!issues.length) return <p className="rounded-lg border border-line bg-paper p-4 text-sm text-ink-soft">No open data issues.</p>

  function toggle(id: string) {
    setSelected((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  function toggleGroup(items: Issue[], allSelected: boolean) {
    setSelected((s) => { const next = new Set(s); items.forEach((it) => (allSelected ? next.delete(it.id) : next.add(it.id))); return next })
  }
  function startEdit(issue: BlockingIssue) {
    setEditingId(issue.id); setEditValue(currentRawValue(issue, mapping))
  }
  function submitEdit(issue: Issue) {
    if (!issue.blocking && issue.kind !== 'blank') return
    onFix([issue.id], { [issue.field]: editValue } as Partial<Record<ColumnField, string>>)
    setEditingId(null); setEditValue('')
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const groupSelected = g.items.filter((it) => selected.has(it.id))
        const allSelected = groupSelected.length === g.items.length && g.items.length > 0
        const field = g.items.find((it) => !isDuplicate(it))?.field
        const canBulkDate = g.items.length > 0 && g.items.every((it) => it.blocking && it.kind === 'date')
        const isWarningGroup = g.items.length > 0 && !g.items[0].blocking

        return (
          <div key={g.category} className="rounded-lg border border-line bg-paper p-3">
            <div className="flex items-baseline justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input type="checkbox" checked={allSelected} onChange={() => toggleGroup(g.items, allSelected)} />
                {g.category}
              </label>
              <span className="rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-warn" style={{ background: tint('var(--warn)') }}>{g.count.toLocaleString()} rows</span>
            </div>
            {g.hint && <p className="mt-0.5 text-[11px] text-ink-soft">{g.hint}</p>}

            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {g.items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded border border-line/60 px-2 py-1 text-[12px]">
                  <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
                  <span className="flex-1 truncate font-mono text-ink-soft">{it.reason}</span>

                  {isDuplicate(it) ? (
                    it.paymentIds.map((pid) => (
                      <button key={pid} onClick={() => onRemoveMember?.(pid)} className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft hover:text-neg">
                        {pid} ✕
                      </button>
                    ))
                  ) : editingId === it.id ? (
                    <>
                      <input autoFocus type={inputType(it)} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        className="w-36 rounded border border-line px-1.5 py-0.5 text-[12px]" />
                      <button onClick={() => submitEdit(it)} className="rounded bg-accent px-2 py-0.5 text-[11px] text-accent-ink">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[11px] text-ink-faint">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => (it.blocking ? startEdit(it) : (setEditingId(it.id), setEditValue('')))} className="text-[11px] text-accent hover:underline">
                        {it.blocking ? 'Edit' : 'Fill'}
                      </button>
                      <button onClick={() => onRemove([it.id])} className="text-[11px] text-neg hover:underline">Remove</button>
                      {!it.blocking && onDismiss && <button onClick={() => onDismiss([it.id])} className="text-[11px] text-ink-faint hover:underline">Ignore</button>}
                    </>
                  )}
                </div>
              ))}
            </div>

            {groupSelected.length > 0 && !isDuplicate(g.items[0]) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <span className="font-mono text-[11px] text-ink-soft">{groupSelected.length} selected</span>
                <button onClick={() => onRemove(groupSelected.map((it) => it.id))} className="rounded border border-line px-2 py-1 text-[11px] text-neg">Remove selected</button>
                {field && (
                  <>
                    <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="value…"
                      className="w-32 rounded border border-line px-1.5 py-0.5 text-[11px]" />
                    <button onClick={() => onFix(groupSelected.map((it) => it.id), { [field]: bulkValue } as Partial<Record<ColumnField, string>>)}
                      className="rounded border border-line px-2 py-1 text-[11px] text-accent">Fill selected</button>
                  </>
                )}
                {canBulkDate && (
                  <select onChange={(e) => e.target.value && onFix(groupSelected.map((it) => it.id), {}, e.target.value as Exclude<DateOrder, 'auto'>)}
                    className="rounded border border-line px-1.5 py-0.5 text-[11px]" defaultValue="">
                    <option value="" disabled>Re-parse as…</option>
                    {DATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                  </select>
                )}
                {isWarningGroup && onDismiss && (
                  <button onClick={() => onDismiss(groupSelected.map((it) => it.id))} className="rounded border border-line px-2 py-1 text-[11px] text-ink-faint">Ignore selected</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

Skipped: "Keep first / keep last" one-click convenience buttons for duplicate groups — per-member ✕ removal already covers it, and duplicate groups are typically small (2-3 rows). Add the convenience buttons later if real usage shows large duplicate groups.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `src/components/upload/DataIssues.tsx` and `src/components/upload/Dropzone.tsx` (Tasks 5 and 8).

- [ ] **Step 4: Commit**

```bash
git add src/components/upload/IssueFixer.tsx src/components/upload/IssueSummary.tsx
git commit -m "feat: add interactive IssueFixer component, remove read-only IssueSummary"
```

---

### Task 5: Wire `IssueFixer` into the pre-Analyze Validate step

**Files:**
- Modify: `src/components/upload/Dropzone.tsx`

Adds local `rowOverrides` / `rowDateOrders` / `removedRows` state, merges them into `normalize()`'s new 5th argument, and swaps `IssueSummary` for `IssueFixer`. Everything here stays local to `Dropzone` — nothing is dispatched to `AppContext` until "Analyze" is clicked, matching how `mapping`/`currencies`/`dateOrder` already work in this file.

- [ ] **Step 1: Replace `src/components/upload/Dropzone.tsx` with the full new implementation**

```tsx
'use client'
import { useMemo, useState } from 'react'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
import type { DateOrder } from '@/src/lib/date'
import { sampleTransactions } from '@/src/lib/sampleData'
import { useApp } from '@/src/state/AppContext'
import { MappingForm } from './MappingForm'
import { FxForm } from './FxForm'
import { IssueFixer } from './IssueFixer'

const DATE_OPTS: { v: DateOrder; label: string }[] = [
  { v: 'auto', label: 'Auto-detect' }, { v: 'dmy', label: 'Day first · DD/MM/YYYY' },
  { v: 'mdy', label: 'Month first · MM/DD/YYYY' }, { v: 'ymd', label: 'Year first · YYYY-MM-DD' },
]
const ORDER_NAME: Record<string, string> = { dmy: 'day-first (DD/MM/YYYY)', mdy: 'month-first (MM/DD/YYYY)', ymd: 'year-first (YYYY-MM-DD)' }

export function Dropzone() {
  const { state, dispatch } = useApp()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [base, setBase] = useState('')
  const [rates, setRates] = useState<FxRates>({})
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto')
  const [error, setError] = useState('')
  const [rowOverrides, setRowOverrides] = useState<Record<number, Record<string, string>>>({})
  const [rowDateOrders, setRowDateOrders] = useState<Record<number, Exclude<DateOrder, 'auto'>>>({})
  const [removedRows, setRemovedRows] = useState<Set<number>>(new Set())

  async function onFile(file: File) {
    try {
      setError('')
      const p = await parseFile(file)
      const m = autoDetect(p.headers)
      setParsed(p); setMapping(m)
      setRowOverrides({}); setRowDateOrders({}); setRemovedRows(new Set())
      const curCol = m.currency
      const curs = curCol ? detectCurrencies(p.rows.map((r) => r[curCol])) : []
      setCurrencies(curs); setBase(curs[0] ?? '')
      setRates(Object.fromEntries(curs.map((c) => [c, 1])))
    } catch (e) { setError(String(e)) }
  }

  const effectiveRates: FxRates = useMemo(() => (currencies.length ? { ...rates, [base]: 1 } : {}), [currencies, rates, base])
  const missing = mapping ? missingRequired(mapping) : []

  // live validation preview — recomputes as mapping / date-format / FX / row-fixes change
  const preview = useMemo(() => {
    if (!parsed || !mapping || missing.length) return null
    return normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder },
      { overrides: rowOverrides, dateOrders: rowDateOrders, removed: removedRows })
  }, [parsed, mapping, missing.length, effectiveRates, dateOrder, state.controls.includeRefunds, rowOverrides, rowDateOrders, removedRows])

  function handleFix(ids: string[], patch: Partial<Record<ColumnField, string>>, order?: Exclude<DateOrder, 'auto'>) {
    if (!preview || !mapping) return
    const targets = preview.issues.filter((it) => ids.includes(it.id))
    if (Object.keys(patch).length) {
      setRowOverrides((prev) => {
        const next = { ...prev }
        for (const it of targets) {
          const patched = { ...(next[it.rowIndex] ?? {}) }
          for (const [field, value] of Object.entries(patch)) {
            const col = mapping[field as ColumnField]
            if (col) patched[col] = value
          }
          next[it.rowIndex] = patched
        }
        return next
      })
    }
    if (order) {
      setRowDateOrders((prev) => {
        const next = { ...prev }
        targets.forEach((it) => { next[it.rowIndex] = order })
        return next
      })
    }
  }

  function handleRemove(ids: string[]) {
    if (!preview) return
    const targets = preview.issues.filter((it) => ids.includes(it.id))
    setRemovedRows((prev) => new Set([...prev, ...targets.map((it) => it.rowIndex)]))
  }

  function analyze() {
    if (!parsed || !mapping) return
    if (missing.length) { setError(`Map required fields: ${missing.join(', ')}`); return }
    const res = preview ?? normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder },
      { overrides: rowOverrides, dateOrders: rowDateOrders, removed: removedRows })
    if (!res.transactions.length) { setError('No valid rows after normalization — check the mapping, date format, and FX rates below.'); return }
    dispatch({ type: 'setMapping', mapping }); dispatch({ type: 'setFx', fxRates: effectiveRates })
    dispatch({ type: 'setData', transactions: res.transactions, issues: res.issues, resolvedDateOrder: res.resolvedDateOrder })
  }

  const valid = preview?.transactions.length ?? 0
  const skipped = preview?.issues.length ?? 0

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-8 py-16">
      <header className="rise">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-display text-xl font-bold text-accent-ink shadow-card">L</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Ledger · Revenue Terminal</div>
        </div>
        <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-ink">
          Turn a payments export<br />into a boardroom-ready<br /><span className="text-accent">revenue picture.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Drop a CSV or Excel of payment rows. Columns auto-detect — confirm the mapping, set FX if multi-currency,
          and 100+ metrics compute entirely in your browser. Nothing is uploaded.
        </p>
      </header>

      <div className="rise flex flex-col gap-3 sm:flex-row sm:items-stretch" style={{ animationDelay: '60ms' }}>
        <label className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-paper p-8 text-center shadow-card transition-colors hover:border-accent">
          <span className="font-display text-base font-medium text-ink">Choose a .csv / .xlsx file</span>
          <span className="font-mono text-[11px] text-ink-soft">or drag it onto this panel</span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-ink hover:file:bg-line-strong" />
        </label>
        <button onClick={() => dispatch({ type: 'setData', transactions: sampleTransactions(), issues: [], resolvedDateOrder: 'mdy' })}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-paper-2 px-7 py-6 text-center shadow-card transition-colors hover:border-accent">
          <span className="font-display text-base font-medium text-ink">Try sample data</span>
          <span className="font-mono text-[11px] text-ink-soft">18 months · 52 accounts →</span>
        </button>
      </div>

      {error && <p className="rounded-lg border border-neg/40 border-l-2 border-l-neg bg-paper px-3 py-2 text-sm text-neg">{error}</p>}

      {parsed && mapping && (
        <div className="space-y-8">
          <section><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Map columns</h2>
            <MappingForm headers={parsed.headers} mapping={mapping} onChange={setMapping} /></section>

          {currencies.length > 1 && (
            <section><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Currency conversion</h2>
              <FxForm currencies={currencies} base={base} rates={rates} onBase={setBase}
                onRate={(c, r) => setRates((x) => ({ ...x, [c]: r }))} /></section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Validate</h2>
              <label className="flex items-center gap-2 text-sm"><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date format</span>
                <select className="rounded-md px-2 py-1 text-sm" value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                  {DATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
            </div>

            {missing.length > 0 ? (
              <p className="rounded-lg border border-warn/40 border-l-2 border-l-warn bg-paper px-3 py-2 text-sm text-warn">Map the required fields first: {missing.join(', ')}</p>
            ) : preview && (
              <>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:border-0">
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Valid rows</div><div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-pos">{valid.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Skipped</div><div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${skipped ? 'text-warn' : 'text-ink'}`}>{skipped.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date order</div><div className="mt-1 font-mono text-sm tabular-nums text-ink">{dateOrder === 'auto' ? `auto → ${ORDER_NAME[preview.resolvedDateOrder]}` : ORDER_NAME[preview.resolvedDateOrder]}</div></div>
                </div>
                {skipped > 0 && (
                  <>
                    <p className="text-[11px] text-ink-soft">{skipped.toLocaleString()} of {preview.total.toLocaleString()} rows can’t be used. Fix them below, or proceed with the {valid.toLocaleString()} valid rows.</p>
                    <IssueFixer issues={preview.issues} mapping={mapping} onFix={handleFix} onRemove={handleRemove} />
                  </>
                )}
              </>
            )}

            <button onClick={analyze} disabled={!preview || valid === 0}
              className="rounded-lg bg-accent px-8 py-2.5 font-mono text-sm font-medium uppercase tracking-wider text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Analyze {valid > 0 ? `${valid.toLocaleString()} rows ` : ''}→
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `src/components/upload/DataIssues.tsx` and `src/components/Shell.tsx` (Task 8).

- [ ] **Step 3: Commit**

```bash
git add src/components/upload/Dropzone.tsx
git commit -m "feat: wire IssueFixer into pre-Analyze Validate step with local row overrides"
```

---

### Task 6: Sidebar — "Data Issues" tab + count badge

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Replace `src/components/layout/Sidebar.tsx` with the full new implementation**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp, type ViewId } from '@/src/state/AppContext'
import { findWarnings } from '@/src/lib/issues'

const ITEMS: { id: ViewId; label: string; idx: string; group: string }[] = [
  { id: 'briefing', label: 'Executive Briefing', idx: '00', group: 'Executive' },
  { id: 'issues', label: 'Data Issues', idx: '01', group: 'Executive' },
  { id: 'overview', label: 'Overview', idx: '01', group: 'Analysis' },
  { id: 'growth', label: 'Growth', idx: '02', group: 'Analysis' },
  { id: 'trends', label: 'Trends', idx: '03', group: 'Analysis' },
  { id: 'cohorts', label: 'Cohorts', idx: '04', group: 'Analysis' },
  { id: 'segments', label: 'Segments', idx: '05', group: 'Analysis' },
  { id: 'customers', label: 'Customers', idx: '06', group: 'Analysis' },
  { id: 'health', label: 'Customer Health', idx: '07', group: 'Analysis' },
  { id: 'bins', label: 'Revenue Bins', idx: '08', group: 'Analysis' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  const issueCount = useMemo(() => {
    const warnings = state.transactions ? findWarnings(state.transactions).filter((w) => !state.dismissedWarningIds.includes(w.id)) : []
    return state.issues.length + warnings.length
  }, [state.transactions, state.issues, state.dismissedWarningIds])

  return (
    <nav className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-paper/70 px-3 py-5 backdrop-blur">
      <div className="mb-7 flex items-center gap-2.5 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent font-display text-lg font-bold text-bone shadow-card">L</div>
        <div>
          <div className="font-display text-[15px] font-bold leading-none tracking-tight text-ink">Ledger</div>
          <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-ink-soft">Revenue Terminal</div>
        </div>
      </div>

      {['Executive', 'Analysis'].map((group) => (
        <div key={group} className="mb-2">
          <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-ink-faint">{group}</div>
          {ITEMS.filter((it) => it.group === group).map((it) => {
            const active = state.view === it.id
            return (
              <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
                className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active ? 'bg-accent text-accent-ink shadow-card' : 'text-ink-soft hover:bg-paper-2 hover:text-ink'}`}>
                <span className={`font-mono text-[10px] tabular-nums ${active ? 'text-accent-ink opacity-70' : 'text-ink-faint'}`}>{it.idx}</span>
                <span className="flex-1">{it.label}</span>
                {it.id === 'issues' && issueCount > 0 && (
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${active ? 'bg-accent-ink/20 text-accent-ink' : 'bg-warn/15 text-warn'}`}>{issueCount}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}

      <button onClick={() => dispatch({ type: 'reset' })}
        className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-ink-faint transition-colors hover:bg-paper-2 hover:text-ink">
        ↺ New upload
      </button>
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add Data Issues tab entry with unresolved-count badge"
```

---

### Task 7: New "Data Issues" dashboard view

**Files:**
- Create: `src/components/views/DataIssues.tsx`

This is the post-Analyze surface: merges remaining `state.issues` (blocking) with `findWarnings(state.transactions)` (non-blocking, minus dismissed), and wires `IssueFixer`'s callbacks to the 5 `AppContext` actions from Task 3.

- [ ] **Step 1: Create `src/components/views/DataIssues.tsx`**

```tsx
'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { normalizeRow } from '@/src/lib/normalize'
import type { BlockingIssue, Issue } from '@/src/lib/normalize'
import { findWarnings } from '@/src/lib/issues'
import { IssueFixer } from '@/src/components/upload/IssueFixer'
import type { ColumnField } from '@/src/lib/mapping'
import type { DateOrder } from '@/src/lib/date'
import type { Transaction } from '@/src/lib/types'

const isBlank = (it: Issue): it is Extract<Issue, { kind: 'blank' }> => !it.blocking && it.kind === 'blank'

export function DataIssues() {
  const { state, dispatch } = useApp()

  const warnings = useMemo(
    () => (state.transactions ? findWarnings(state.transactions).filter((w) => !state.dismissedWarningIds.includes(w.id)) : []),
    [state.transactions, state.dismissedWarningIds],
  )
  const allIssues: Issue[] = [...state.issues, ...warnings]

  function handleFix(ids: string[], patch: Partial<Record<ColumnField, string>>, order?: Exclude<DateOrder, 'auto'>) {
    if (!state.mapping) return
    const targets = allIssues.filter((it) => ids.includes(it.id))

    const blockingResults = targets.filter((it): it is BlockingIssue => it.blocking).map((it) => {
      const patchedRaw = { ...it.raw }
      for (const [field, value] of Object.entries(patch)) {
        const col = state.mapping![field as ColumnField]
        if (col) patchedRaw[col] = value
      }
      const dateOrder = order ?? state.resolvedDateOrder ?? 'mdy'
      const result = normalizeRow(patchedRaw, it.rowIndex, state.mapping!, state.fxRates, { includeRefunds: state.controls.includeRefunds, dateOrder })
      return 'transaction' in result ? { id: it.id, transaction: result.transaction } : { id: it.id, issue: result.issue }
    })
    if (blockingResults.length) dispatch({ type: 'resolveIssues', results: blockingResults })

    const blankValue = Object.values(patch)[0] ?? ''
    const blankPatches = targets.filter(isBlank).map((it) => ({ paymentId: it.paymentId, patch: { [it.field]: blankValue } as Partial<Transaction> }))
    if (blankPatches.length) dispatch({ type: 'patchTransactions', patches: blankPatches })
  }

  function handleRemove(ids: string[]) {
    const targets = allIssues.filter((it) => ids.includes(it.id))
    const blockingIds = targets.filter((it) => it.blocking).map((it) => it.id)
    if (blockingIds.length) dispatch({ type: 'removeIssues', ids: blockingIds })
    const paymentIds = targets.filter(isBlank).map((it) => it.paymentId)
    if (paymentIds.length) dispatch({ type: 'removeTransactions', paymentIds })
  }

  function handleRemoveMember(paymentId: string) {
    dispatch({ type: 'removeTransactions', paymentIds: [paymentId] })
  }

  function handleDismiss(ids: string[]) {
    dispatch({ type: 'dismissWarnings', ids })
  }

  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Data Issues</h2>
      {state.mapping ? (
        <IssueFixer issues={allIssues} mapping={state.mapping} onFix={handleFix} onRemove={handleRemove}
          onRemoveMember={handleRemoveMember} onDismiss={handleDismiss} />
      ) : (
        <p className="text-sm text-ink-soft">No column mapping on record — re-upload to fix remaining issues.</p>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: remaining errors only in `src/components/upload/DataIssues.tsx` and `src/components/Shell.tsx` (Task 8, next).

- [ ] **Step 3: Commit**

```bash
git add src/components/views/DataIssues.tsx
git commit -m "feat: add post-Analyze Data Issues view (blocking issues + warnings)"
```

---

### Task 8: Retire the old read-only widget, wire the new tab into `Shell`

**Files:**
- Modify: `src/components/Shell.tsx`
- Delete: `src/components/upload/DataIssues.tsx` (the old collapsible `<details>` widget — fully superseded by the new tab)

- [ ] **Step 1: Delete the superseded widget**

```bash
git rm src/components/upload/DataIssues.tsx
```

- [ ] **Step 2: Replace `src/components/Shell.tsx` with the full new implementation**

```tsx
'use client'
import { useApp } from '@/src/state/AppContext'
import { Dropzone } from '@/src/components/upload/Dropzone'
import { Sidebar } from '@/src/components/layout/Sidebar'
import { ControlBar } from '@/src/components/layout/ControlBar'
import { Briefing } from '@/src/components/views/Briefing'
import { DataIssues } from '@/src/components/views/DataIssues'
import { Overview } from '@/src/components/views/Overview'
import { Growth } from '@/src/components/views/Growth'
import { Trends } from '@/src/components/views/Trends'
import { Cohorts } from '@/src/components/views/Cohorts'
import { Segments } from '@/src/components/views/Segments'
import { Customers } from '@/src/components/views/Customers'
import { Health } from '@/src/components/views/Health'
import { Bins } from '@/src/components/views/Bins'

export function Shell() {
  const { state, dispatch } = useApp()
  if (!state.transactions) return <Dropzone />
  const view = {
    briefing: <Briefing />, issues: <DataIssues />, overview: <Overview />, growth: <Growth />, trends: <Trends />, cohorts: <Cohorts />,
    segments: <Segments />, customers: <Customers />, health: <Health />, bins: <Bins />,
  }[state.view]

  if (state.present) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 p-8">
        <button onClick={() => dispatch({ type: 'setPresent', present: false })}
          className="no-print fixed right-4 top-4 z-50 rounded-md border border-line-strong bg-paper px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft shadow-card hover:text-ink">✕ Exit present</button>
        {view}
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <ControlBar />
        <main key={state.view} className="rise mx-auto max-w-7xl space-y-6 p-8">
          {view}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Full typecheck — must be clean now**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (103 existing + 4 from Task 1 + 7 from Task 2 = 114).

- [ ] **Step 5: Commit**

```bash
git add src/components/Shell.tsx
git commit -m "feat: replace read-only issue widget with Data Issues tab in Shell"
```

---

### Task 9: Manual browser verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and prepare a bad CSV**

Create a small CSV covering every issue kind — save it to your scratchpad, not the repo:

```csv
PaymentID,InvoiceNumber,Date,CustomerID,Name,Country,Region,BusinessModel,Currency,Amount
p1,inv1,2026-01-15,c1,Acme,US,NA,sub,USD,100
p2,inv2,08-05-2026 05:16,c2,Beta,,NA,sub,USD,200
p3,inv3,2026-01-20,c3,Gamma,US,NA,sub,ZZZ,150
p4,inv4,2026-01-21,,Delta,US,NA,sub,USD,80
p5,inv4,2026-01-22,c5,Epsilon,US,NA,sub,USD,90
p5,inv6,2026-01-22,c5,Epsilon,US,NA,sub,USD,90
```

This covers: row 1 clean, row 2 a fixable trailing-time date + blank country, row 3 unknown currency, row 4 missing customer ID, row 5 a duplicate invoice number (`inv4` reused), row 6 a full duplicate of row 5's `paymentId` (`p5` reused, also a `duplicateRow` since customer+date+amount match a row with the same `paymentId` — actually row 5 and row 6 share `p5` fully, exercising both `duplicateId` and `duplicateRow` at once).

- [ ] **Step 2: Verify the pre-Analyze Validate step**

Upload the CSV. Confirm:
- "Skipped" shows 3 (rows 2 date / 3 currency / 4 customerId — row 2's date actually now parses correctly per the trailing-time fix already in `date.ts`, so re-check the actual skip count matches whichever rows genuinely fail parsing/currency/customerId at this point).
- The issue list groups by category (Dates/Currency/Customer ID as applicable).
- Click **Edit** on the currency issue, type `USD`, Save — row moves out of the skipped list, "Valid rows" count increases.
- Click **Remove** on the customerId issue — "Skipped" count decreases, total stays the same.
- Click **Analyze**.

- [ ] **Step 3: Verify the post-Analyze Data Issues tab**

- Confirm the Sidebar shows a "Data Issues" entry with a count badge (from the duplicate invoice number / duplicate row / blank country in the sample data).
- Open the tab. Confirm "Missing details" (blank country), "Duplicate IDs" (inv4), and "Duplicate rows" groups render.
- Click **Fill** on the blank-country warning, type `US`, Save — it disappears from the list.
- Click **Ignore** on some other warning — confirm it disappears and does not return after switching tabs and back.
- On the duplicate-row group, click the ✕ next to one member's paymentId — confirm it's removed and the group either shrinks or disappears if only one member remains.
- Reload the page — confirm the fixed/ignored/removed state survived (localStorage persistence).

- [ ] **Step 4: Check for console errors**

Use the browser preview tools to confirm no console errors or failed network requests occurred during the above.

- [ ] **Step 5: No commit** (verification only — if any bugs were found and fixed, commit those fixes individually with their own descriptive messages).

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** all 4 new issue kinds (Task 1 + 2), all 4 row actions (Task 4), all 4 bulk behaviors except "keep first/last" convenience (Task 4, explicitly skipped with rationale), pre-Analyze + post-Analyze placement (Tasks 5 + 7), dedicated tab (Task 6) — all covered.
- **Known simplification:** duplicate-group "keep first/keep last" one-click buttons are skipped in favor of per-member removal (Task 4 note). Revisit if real files show large duplicate clusters.
- **Type consistency check performed:** `Issue`/`BlockingIssue`/`BlankFieldIssue`/`DuplicateIdIssue`/`DuplicateRowIssue` names and shapes are identical across Tasks 1, 2, 3, 4, 7. `IssueFixerProps` in Task 4 matches its usage in Tasks 5 and 7 exactly (same callback names and signatures).
