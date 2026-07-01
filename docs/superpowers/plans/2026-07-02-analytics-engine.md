# SaaS Analytics Engine Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, fully-tested analytics engine + data pipeline (parse → map → FX → normalize → matrix → all core metrics) as a headless TypeScript library, with zero UI.

**Architecture:** Every metric derives from one structure — `Matrix` = `M[customerId][month] = revenueBase`. Pipeline stages are pure functions with explicit inputs/outputs. Two MRR modes (activity / subscription-inferred) and a refund toggle change how the matrix is built; all downstream metrics read the built matrix. Nothing here imports React.

**Tech Stack:** TypeScript, Vitest, papaparse (CSV), xlsx/SheetJS (Excel). Node ≥ 20.

**Companion docs:** spec `docs/superpowers/specs/2026-07-02-saas-revenue-analytics-dashboard-design.md`; full formulas `docs/metrics-catalog.md`.

**Convention for every task:** write the failing test → run it, see it fail → implement → run, see it pass → commit. Test files sit next to source as `*.test.ts`. Run a single file with `npx vitest run src/lib/<file>.test.ts`.

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts
src/lib/types.ts              shared types (Transaction, Matrix, Controls, enums)
src/lib/parse.ts              File/string → { headers, rows }
src/lib/mapping.ts            auto-detect column mapping + apply mapping
src/lib/fx.ts                 detect currencies, convert to base
src/lib/normalize.ts          rows + mapping + fx + refund toggle → Transaction[] + issues
src/lib/engine/matrix.ts      Transaction[] + mode → Matrix (+ helpers: months, customers, active)
src/lib/engine/movement.ts    Matrix → per-month MRR movement + bridge identity
src/lib/engine/cohorts.ts     Matrix → dollar-retention triangle + logo survival
src/lib/engine/bins.ts        Matrix + bin config → month-wise bin analysis
src/lib/engine/kpis.ts        Matrix/movement → MRR/ARR/ARPA/retention/growth/LTV/ruleOf40
src/lib/engine/segments.ts    Transaction[]/Matrix → by-dimension, top-N, HHI, RFM, new-vs-repeat
src/lib/engine/customers.ts   Transaction[]/Matrix → tenure, recency, dormancy, at-risk, refunds
src/lib/testdata.ts           synthetic Transaction[] fixtures used across tests
```

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/lib/.gitkeep`

- [ ] **Step 1: Init and install**

Run:
```bash
npm init -y
npm i papaparse xlsx
npm i -D typescript vitest @types/node @types/papaparse
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })
```

- [ ] **Step 4: Add scripts to `package.json`**

Set `"type": "module"` and merge:
```json
"scripts": { "test": "vitest run", "test:watch": "vitest" }
```

- [ ] **Step 5: Verify the toolchain**

Run: `npx vitest run`
Expected: exits 0 with "No test files found".

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts
git commit -m "chore: scaffold analytics engine (ts + vitest)"
```

---

## Task 1: Core types

**Files:**
- Create: `src/lib/types.ts`
- Test: `src/lib/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { MRR_MODES, monthKey, addMonths, monthRange } from './types'

describe('month helpers', () => {
  it('formats a month key as YYYY-MM', () => {
    expect(monthKey(new Date('2026-03-15T00:00:00Z'))).toBe('2026-03')
  })
  it('adds months across a year boundary', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-02', -3)).toBe('2025-11')
  })
  it('builds an inclusive contiguous range', () => {
    expect(monthRange('2026-01', '2026-04')).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
  })
  it('exposes the two MRR modes', () => {
    expect(MRR_MODES).toEqual(['activity', 'subscription'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/types.test.ts`
Expected: FAIL — cannot find module './types'.

- [ ] **Step 3: Write `src/lib/types.ts`**

```ts
export const MRR_MODES = ['activity', 'subscription'] as const
export type MrrMode = (typeof MRR_MODES)[number]

/** A cleaned, FX-converted payment. amountBase is negative for refunds when they are subtracted. */
export type Transaction = {
  paymentId: string
  invoiceNumber: string | null
  date: Date
  month: string // 'YYYY-MM'
  customerId: string
  name: string | null
  country: string | null
  region: string | null
  businessModel: string | null
  currency: string | null // native
  amountNative: number
  amountBase: number // FX-converted, signed (negative if a subtracted refund)
  isRefund: boolean
}

/** M[customerId][month] = revenue in base currency. Missing month => absent (treat as 0). */
export type Matrix = {
  cells: Map<string, Map<string, number>> // customerId -> month -> revenue
  months: string[] // sorted, contiguous
  customers: string[]
  mode: MrrMode
}

export type BinDef = { label: string; min: number; max: number | null } // (min, max]; max=null => open top

export type Controls = {
  mode: MrrMode
  includeRefunds: boolean
  reactivationGapK: number // min zero-months to count a return as reactivation
  dormancyDays: number
  atRiskStreak: number
  grossMargin: number // 0..1, LTV assumption
}

export const DEFAULT_BINS: BinDef[] = [
  { label: 'Less than $250', min: -Infinity, max: 250 },
  { label: '$251 - $500', min: 250, max: 500 },
  { label: '$501 - $1000', min: 500, max: 1000 },
  { label: '$1001 - $2500', min: 1000, max: 2500 },
  { label: 'More than $2500', min: 2500, max: null },
]

export function monthKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12 + 12) % 12
  return `${ny}-${String(nm + 1).padStart(2, '0')}`
}

/** Number of months from a to b (b - a). */
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return by * 12 + bm - (ay * 12 + am)
}

export function monthRange(start: string, end: string): string[] {
  const out: string[] = []
  for (let m = start; monthDiff(m, end) >= 0; m = addMonths(m, 1)) out.push(m)
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/types.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/types.test.ts
git commit -m "feat(engine): core types + month helpers"
```

---

## Task 2: Parse CSV/Excel

**Files:**
- Create: `src/lib/parse.ts`
- Test: `src/lib/parse.test.ts`

Output shape: `{ headers: string[]; rows: Record<string, string>[] }`. Values are raw strings; typing happens in normalize.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { parseCsv } from './parse'

describe('parseCsv', () => {
  it('returns headers and row objects', () => {
    const csv = 'Date,customer_id,Overall Revenue\n2026-01-01,c1,100\n2026-01-02,c2,200\n'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Date', 'customer_id', 'Overall Revenue'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ Date: '2026-01-01', customer_id: 'c1', 'Overall Revenue': '100' })
  })
  it('trims header whitespace and skips fully-empty rows', () => {
    const csv = ' Date , customer_id \n2026-01-01,c1\n\n'
    const { headers, rows } = parseCsv(csv)
    expect(headers).toEqual(['Date', 'customer_id'])
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/parse.test.ts`
Expected: FAIL — cannot find './parse'.

- [ ] **Step 3: Write `src/lib/parse.ts`**

```ts
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type ParsedFile = { headers: string[]; rows: Record<string, string>[] }

export function parseCsv(text: string): ParsedFile {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  const rows = (res.data || []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''))
  const headers = res.meta.fields ? res.meta.fields.map((h) => h.trim()) : []
  return { headers, rows }
}

/** Excel: read the first sheet, coerce every cell to string, header = first row. */
export function parseExcel(data: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  const headers = json.length ? Object.keys(json[0]).map((h) => h.trim()) : []
  const rows = json
    .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v ?? '')])))
    .filter((r) => Object.values(r).some((v) => v.trim() !== ''))
  return { headers, rows }
}

export async function parseFile(file: File): Promise<ParsedFile> {
  if (/\.(xlsx|xls)$/i.test(file.name)) return parseExcel(await file.arrayBuffer())
  return parseCsv(await file.text())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/parse.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/parse.ts src/lib/parse.test.ts
git commit -m "feat(engine): CSV/Excel parsing"
```

---

## Task 3: Column mapping (auto-detect + apply)

**Files:**
- Create: `src/lib/mapping.ts`
- Test: `src/lib/mapping.test.ts`

`ColumnField` is the canonical field set; `autoDetect(headers)` returns a best-guess `Mapping`; `REQUIRED_FIELDS` are the 3 blockers.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { autoDetect, missingRequired, REQUIRED_FIELDS } from './mapping'

describe('autoDetect', () => {
  it('maps known headers case/space/underscore-insensitively', () => {
    const m = autoDetect([
      'Payment ID', 'Invoice Number', 'Date', 'customer_id', 'Name',
      'Country', 'Business Model', 'Currency', 'Overall Revenue', 'Refund Flag', 'Region',
    ])
    expect(m.date).toBe('Date')
    expect(m.customerId).toBe('customer_id')
    expect(m.amount).toBe('Overall Revenue')
    expect(m.businessModel).toBe('Business Model')
    expect(m.refundFlag).toBe('Refund Flag')
  })
  it('leaves unknown fields null and reports required gaps', () => {
    const m = autoDetect(['foo', 'bar'])
    expect(m.date).toBeNull()
    expect(missingRequired(m).sort()).toEqual([...REQUIRED_FIELDS].sort())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mapping.test.ts`
Expected: FAIL — cannot find './mapping'.

- [ ] **Step 3: Write `src/lib/mapping.ts`**

```ts
export type ColumnField =
  | 'paymentId' | 'invoiceNumber' | 'date' | 'customerId' | 'name'
  | 'country' | 'region' | 'businessModel' | 'currency' | 'amount'
  | 'customerFlag' | 'refundFlag'

export type Mapping = Record<ColumnField, string | null>

export const REQUIRED_FIELDS: ColumnField[] = ['date', 'customerId', 'amount']

/** Header synonyms per field, normalized (lowercase, alnum only). */
const SYNONYMS: Record<ColumnField, string[]> = {
  paymentId: ['paymentid', 'payment', 'txnid', 'transactionid'],
  invoiceNumber: ['invoicenumber', 'invoice', 'invoiceno', 'invoiceid'],
  date: ['date', 'paymentdate', 'transactiondate', 'createdat', 'timestamp'],
  customerId: ['customerid', 'custid', 'accountid', 'userid', 'customer'],
  name: ['name', 'customername', 'accountname', 'company'],
  country: ['country'],
  region: ['region', 'geo', 'territory'],
  businessModel: ['businessmodel', 'model', 'plan', 'producttype'],
  currency: ['currency', 'curr', 'ccy'],
  amount: ['overallrevenue', 'revenue', 'amount', 'total', 'grossrevenue', 'netrevenue', 'mrr'],
  customerFlag: ['customerflag', 'newrepeat', 'customertype'],
  refundFlag: ['refundflag', 'isrefund', 'refund', 'refunded'],
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function autoDetect(headers: string[]): Mapping {
  const normed = headers.map((h) => ({ raw: h, n: norm(h) }))
  const out = {} as Mapping
  for (const field of Object.keys(SYNONYMS) as ColumnField[]) {
    const syns = SYNONYMS[field]
    // exact-normalized match first, then contains
    const hit =
      normed.find((h) => syns.includes(h.n)) ??
      normed.find((h) => syns.some((s) => h.n.includes(s)))
    out[field] = hit ? hit.raw : null
  }
  return out
}

export function missingRequired(m: Mapping): ColumnField[] {
  return REQUIRED_FIELDS.filter((f) => !m[f])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/mapping.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapping.ts src/lib/mapping.test.ts
git commit -m "feat(engine): column auto-detect + mapping"
```

---

## Task 4: FX conversion

**Files:**
- Create: `src/lib/fx.ts`
- Test: `src/lib/fx.test.ts`

`FxRates` maps a currency code → multiplier to base. Base currency has rate 1. Unknown currency ⇒ `convert` returns `null` (caller quarantines the row).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { detectCurrencies, convert } from './fx'

describe('fx', () => {
  it('lists distinct non-empty currencies', () => {
    expect(detectCurrencies(['USD', 'EUR', 'USD', '', 'INR']).sort()).toEqual(['EUR', 'INR', 'USD'])
  })
  it('converts using the rate table', () => {
    const rates = { USD: 1, EUR: 1.1 }
    expect(convert(100, 'EUR', rates)).toBeCloseTo(110)
    expect(convert(100, 'USD', rates)).toBe(100)
  })
  it('returns null for an unknown currency', () => {
    expect(convert(100, 'JPY', { USD: 1 })).toBeNull()
  })
  it('treats a null/empty currency as base (rate 1)', () => {
    expect(convert(100, null, { USD: 1 })).toBe(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/fx.test.ts`
Expected: FAIL — cannot find './fx'.

- [ ] **Step 3: Write `src/lib/fx.ts`**

```ts
export type FxRates = Record<string, number> // currency code -> multiplier to base

export function detectCurrencies(values: (string | null)[]): string[] {
  const set = new Set<string>()
  for (const v of values) {
    const c = (v ?? '').trim()
    if (c) set.add(c)
  }
  return [...set]
}

/** amount in native currency -> base. null currency counts as base. Unknown code -> null. */
export function convert(amount: number, currency: string | null, rates: FxRates): number | null {
  const c = (currency ?? '').trim()
  if (!c) return amount
  const rate = rates[c]
  if (rate === undefined) return null
  return amount * rate
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/fx.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fx.ts src/lib/fx.test.ts
git commit -m "feat(engine): currency detection + FX conversion"
```

---

## Task 5: Normalize rows → Transaction[]

**Files:**
- Create: `src/lib/normalize.ts`
- Test: `src/lib/normalize.test.ts`

Turns raw rows + mapping + FX + refund toggle into `Transaction[]` plus a `DataIssue[]` list. Refund rows are **separate signed rows**: when `includeRefunds`, a refund's `amountBase` is forced negative and subtracts; when off, refund rows are dropped. A row with a truthy refund flag OR a negative amount is treated as a refund.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { normalize } from './normalize'
import type { Mapping } from './mapping'

const mapping: Mapping = {
  paymentId: 'pid', invoiceNumber: 'inv', date: 'Date', customerId: 'cid', name: 'Name',
  country: 'Country', region: 'Region', businessModel: 'BM', currency: 'Ccy',
  amount: 'Amt', customerFlag: 'CF', refundFlag: 'RF',
}
const row = (o: Partial<Record<string, string>>) => ({
  pid: 'p', inv: 'i', Date: '2026-01-15', cid: 'c1', Name: 'A', Country: 'US',
  Region: 'NA', BM: 'sub', Ccy: 'USD', Amt: '100', CF: 'new', RF: 'false', ...o,
})

describe('normalize', () => {
  it('builds a transaction with month bucket and base amount', () => {
    const { transactions, issues } = normalize([row({})], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues).toHaveLength(0)
    expect(transactions[0].month).toBe('2026-01')
    expect(transactions[0].amountBase).toBe(100)
    expect(transactions[0].isRefund).toBe(false)
  })
  it('makes refund amounts negative when refunds are included', () => {
    const { transactions } = normalize(
      [row({ RF: 'true', Amt: '40' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(transactions[0].isRefund).toBe(true)
    expect(transactions[0].amountBase).toBe(-40)
  })
  it('drops refund rows when refunds are excluded', () => {
    const { transactions } = normalize(
      [row({ RF: 'true', Amt: '40' })], mapping, { USD: 1 }, { includeRefunds: false })
    expect(transactions).toHaveLength(0)
  })
  it('quarantines unparseable dates and non-numeric amounts', () => {
    const { transactions, issues } = normalize(
      [row({ Date: 'nope' }), row({ Amt: 'abc' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(transactions).toHaveLength(0)
    expect(issues).toHaveLength(2)
    expect(issues[0].reason).toMatch(/date/i)
  })
  it('quarantines rows in an unknown currency', () => {
    const { issues } = normalize([row({ Ccy: 'JPY' })], mapping, { USD: 1 }, { includeRefunds: true })
    expect(issues[0].reason).toMatch(/currency/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/normalize.test.ts`
Expected: FAIL — cannot find './normalize'.

- [ ] **Step 3: Write `src/lib/normalize.ts`**

```ts
import type { Mapping } from './mapping'
import type { Transaction } from './types'
import { monthKey } from './types'
import { convert, type FxRates } from './fx'

export type DataIssue = { rowIndex: number; reason: string; raw: Record<string, string> }
export type NormalizeOpts = { includeRefunds: boolean }
export type NormalizeResult = { transactions: Transaction[]; issues: DataIssue[] }

const TRUE = new Set(['true', '1', 'yes', 'y', 't', 'refund', 'refunded'])

function get(row: Record<string, string>, col: string | null): string | null {
  if (!col) return null
  const v = row[col]
  return v == null ? null : String(v).trim()
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[$,\s]/g, '')
  if (cleaned === '' || isNaN(Number(cleaned))) return null
  return Number(cleaned)
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  rates: FxRates,
  opts: NormalizeOpts,
): NormalizeResult {
  const transactions: Transaction[] = []
  const issues: DataIssue[] = []

  rows.forEach((raw, i) => {
    const dateStr = get(raw, mapping.date)
    const d = dateStr ? new Date(dateStr) : null
    if (!d || isNaN(d.getTime())) {
      issues.push({ rowIndex: i, reason: `Unparseable date: "${dateStr ?? ''}"`, raw })
      return
    }
    const amtStr = get(raw, mapping.amount) ?? ''
    const amt = parseAmount(amtStr)
    if (amt === null) {
      issues.push({ rowIndex: i, reason: `Non-numeric amount: "${amtStr}"`, raw })
      return
    }
    const currency = get(raw, mapping.currency)
    const base = convert(Math.abs(amt), currency, rates)
    if (base === null) {
      issues.push({ rowIndex: i, reason: `Unknown currency: "${currency ?? ''}" (add an FX rate)`, raw })
      return
    }
    const refundFlag = (get(raw, mapping.refundFlag) ?? '').toLowerCase()
    const isRefund = TRUE.has(refundFlag) || amt < 0

    if (isRefund && !opts.includeRefunds) return // gross view: ignore refunds

    transactions.push({
      paymentId: get(raw, mapping.paymentId) ?? String(i),
      invoiceNumber: get(raw, mapping.invoiceNumber),
      date: d,
      month: monthKey(d),
      customerId: get(raw, mapping.customerId) ?? '',
      name: get(raw, mapping.name),
      country: get(raw, mapping.country),
      region: get(raw, mapping.region),
      businessModel: get(raw, mapping.businessModel),
      currency,
      amountNative: amt,
      amountBase: isRefund ? -Math.abs(base) : Math.abs(base),
      isRefund,
    })
  })

  return { transactions, issues }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/normalize.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/normalize.ts src/lib/normalize.test.ts
git commit -m "feat(engine): normalize rows to transactions + data issues"
```

---

## Task 6: Shared test fixtures + Matrix builder

**Files:**
- Create: `src/lib/testdata.ts`, `src/lib/engine/matrix.ts`
- Test: `src/lib/engine/matrix.test.ts`

`buildMatrix(transactions, mode, range?)` sums base amounts per customer per month (activity mode), or amortizes across an inferred term (subscription mode). Months are contiguous from earliest to latest transaction (or the passed range).

- [ ] **Step 1: Write `src/lib/testdata.ts`**

```ts
import type { Transaction } from './types'

let seq = 0
export function tx(p: Partial<Transaction> & { customerId: string; month: string; amountBase: number }): Transaction {
  const [y, m] = p.month.split('-').map(Number)
  return {
    paymentId: p.paymentId ?? `p${seq++}`,
    invoiceNumber: p.invoiceNumber ?? `i${seq}`,
    date: p.date ?? new Date(Date.UTC(y, m - 1, 15)),
    month: p.month,
    customerId: p.customerId,
    name: p.name ?? p.customerId,
    country: p.country ?? 'US',
    region: p.region ?? 'NA',
    businessModel: p.businessModel ?? 'sub',
    currency: p.currency ?? 'USD',
    amountNative: p.amountNative ?? p.amountBase,
    amountBase: p.amountBase,
    isRefund: p.isRefund ?? p.amountBase < 0,
  }
}

/**
 * Scenario used across engine tests:
 *  c1: 100 in Jan, 150 in Feb (expansion), 150 in Mar (retained)
 *  c2: 200 in Jan, 0 in Feb (churn), 200 in Mar (reactivation, gap 1)
 *  c3: new 300 in Feb, 250 in Mar (contraction)
 */
export function scenario(): Transaction[] {
  return [
    tx({ customerId: 'c1', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'c1', month: '2026-02', amountBase: 150 }),
    tx({ customerId: 'c1', month: '2026-03', amountBase: 150 }),
    tx({ customerId: 'c2', month: '2026-01', amountBase: 200 }),
    tx({ customerId: 'c2', month: '2026-03', amountBase: 200 }),
    tx({ customerId: 'c3', month: '2026-02', amountBase: 300, businessModel: 'onetime', region: 'EU' }),
    tx({ customerId: 'c3', month: '2026-03', amountBase: 250, businessModel: 'onetime', region: 'EU' }),
  ]
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix, mrrOf, activeCustomers, get } from './matrix'
import { scenario, tx } from '../testdata'

describe('buildMatrix (activity mode)', () => {
  const m = buildMatrix(scenario(), 'activity')
  it('has a contiguous month axis', () => {
    expect(m.months).toEqual(['2026-01', '2026-02', '2026-03'])
  })
  it('sums payments per customer-month', () => {
    expect(get(m, 'c1', '2026-02')).toBe(150)
    expect(get(m, 'c2', '2026-02')).toBe(0) // gap filled with 0
  })
  it('computes MRR as the column sum', () => {
    expect(mrrOf(m, '2026-01')).toBe(300) // 100 + 200
    expect(mrrOf(m, '2026-03')).toBe(600) // 150 + 200 + 250
  })
  it('counts active (nonzero) customers per month', () => {
    expect(activeCustomers(m, '2026-02')).toBe(2) // c1, c3
  })
})

describe('buildMatrix (subscription mode)', () => {
  it('amortizes an annual payment across 12 months', () => {
    const txs = [
      tx({ customerId: 'a', month: '2026-01', amountBase: 1200, date: new Date(Date.UTC(2026, 0, 1)) }),
      tx({ customerId: 'a', month: '2027-01', amountBase: 1200, date: new Date(Date.UTC(2027, 0, 1)) }),
    ]
    const m = buildMatrix(txs, 'subscription')
    expect(get(m, 'a', '2026-01')).toBeCloseTo(100)
    expect(get(m, 'a', '2026-06')).toBeCloseTo(100)
    expect(get(m, 'a', '2026-12')).toBeCloseTo(100)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/matrix.test.ts`
Expected: FAIL — cannot find './matrix'.

- [ ] **Step 4: Write `src/lib/engine/matrix.ts`**

```ts
import type { Matrix, MrrMode, Transaction } from '../types'
import { addMonths, monthDiff, monthKey, monthRange } from '../types'

export function get(m: Matrix, customer: string, month: string): number {
  return m.cells.get(customer)?.get(month) ?? 0
}

function set(cells: Map<string, Map<string, number>>, c: string, month: string, v: number) {
  let row = cells.get(c)
  if (!row) cells.set(c, (row = new Map()))
  row.set(month, (row.get(month) ?? 0) + v)
}

/** Median gap in months between a customer's sorted distinct payment months. */
function inferTermMonths(months: string[]): number {
  if (months.length < 2) return 1 // single payment => one-time (span of 1)
  const gaps: number[] = []
  for (let i = 1; i < months.length; i++) gaps.push(monthDiff(months[i - 1], months[i]))
  gaps.sort((a, b) => a - b)
  const med = gaps[Math.floor(gaps.length / 2)]
  if (med <= 1.5) return 1
  if (med <= 4) return 3
  return 12 // annual/lump
}

export function buildMatrix(transactions: Transaction[], mode: MrrMode, range?: [string, string]): Matrix {
  const cells = new Map<string, Map<string, number>>()
  if (transactions.length === 0) {
    return { cells, months: [], customers: [], mode }
  }
  let min = transactions[0].month
  let max = transactions[0].month
  for (const t of transactions) {
    if (monthDiff(t.month, min) > 0) min = t.month
    if (monthDiff(max, t.month) > 0) max = t.month
  }
  if (range) { min = range[0]; max = range[1] }

  if (mode === 'activity') {
    for (const t of transactions) set(cells, t.customerId, t.month, t.amountBase)
  } else {
    // subscription: group by customer, infer term from active months, amortize each payment forward
    const byCust = new Map<string, Transaction[]>()
    for (const t of transactions) {
      const arr = byCust.get(t.customerId) ?? []
      arr.push(t)
      byCust.set(t.customerId, arr)
    }
    for (const [cust, txs] of byCust) {
      const activeMonths = [...new Set(txs.map((t) => t.month))].sort()
      const term = inferTermMonths(activeMonths)
      for (const t of txs) {
        const per = t.amountBase / term
        for (let k = 0; k < term; k++) set(cells, cust, addMonths(t.month, k), per)
      }
    }
  }

  const months = monthRange(min, max)
  const customers = [...cells.keys()]
  return { cells, months, customers, mode }
}

export function mrrOf(m: Matrix, month: string): number {
  let sum = 0
  for (const c of m.customers) sum += get(m, c, month)
  return sum
}

export function activeCustomers(m: Matrix, month: string): number {
  let n = 0
  for (const c of m.customers) if (get(m, c, month) !== 0) n++
  return n
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/matrix.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/testdata.ts src/lib/engine/matrix.ts src/lib/engine/matrix.test.ts
git commit -m "feat(engine): matrix builder (activity + subscription modes) + fixtures"
```

---

## Task 7: Revenue movement (MRR bridge)

**Files:**
- Create: `src/lib/engine/movement.ts`
- Test: `src/lib/engine/movement.test.ts`

Per month (from the second month on) classify each customer's delta into new / expansion / contraction / churn / reactivation, then assert the bridge identity.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix, mrrOf } from './matrix'
import { movementSeries } from './movement'
import { scenario } from '../testdata'

describe('movementSeries', () => {
  const m = buildMatrix(scenario(), 'activity')
  const series = movementSeries(m, { reactivationGapK: 1 })
  const feb = series.find((s) => s.month === '2026-02')!
  const mar = series.find((s) => s.month === '2026-03')!

  it('classifies Feb: c1 expansion +50, c2 churn -200, c3 new +300', () => {
    expect(feb.expansion).toBe(50)
    expect(feb.churn).toBe(200)
    expect(feb.newMrr).toBe(300)
    expect(feb.reactivation).toBe(0)
    expect(feb.contraction).toBe(0)
  })
  it('classifies Mar: c2 reactivation +200, c3 contraction -50', () => {
    expect(mar.reactivation).toBe(200)
    expect(mar.contraction).toBe(50)
    expect(mar.newMrr).toBe(0)
  })
  it('satisfies the bridge identity every month', () => {
    for (const s of series) {
      const prev = mrrOf(m, s.month === '2026-01' ? '2026-01' : s.prevMonth!)
      const expected = mrrOf(m, s.month)
      const bridge = prev + s.newMrr + s.expansion + s.reactivation - s.contraction - s.churn
      expect(bridge).toBeCloseTo(expected)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/movement.test.ts`
Expected: FAIL — cannot find './movement'.

- [ ] **Step 3: Write `src/lib/engine/movement.ts`**

```ts
import type { Matrix } from '../types'
import { get } from './matrix'

export type Movement = {
  month: string
  prevMonth: string | null
  newMrr: number
  expansion: number
  contraction: number
  churn: number
  reactivation: number
  netNew: number
}

export type MovementOpts = { reactivationGapK: number }

/** First active month per customer (earliest month with nonzero revenue). */
function firstActive(m: Matrix): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of m.customers) {
    for (const mo of m.months) {
      if (get(m, c, mo) !== 0) { out.set(c, mo); break }
    }
  }
  return out
}

/** True if the customer was active at any month strictly before `month`. */
function activeBefore(m: Matrix, c: string, monthIdx: number): boolean {
  for (let i = 0; i < monthIdx; i++) if (get(m, c, m.months[i]) !== 0) return true
  return false
}

/** Count of consecutive zero months immediately before monthIdx. */
function zeroRunBefore(m: Matrix, c: string, monthIdx: number): number {
  let n = 0
  for (let i = monthIdx - 1; i >= 0; i--) {
    if (get(m, c, m.months[i]) === 0) n++
    else break
  }
  return n
}

export function movementSeries(m: Matrix, opts: MovementOpts): Movement[] {
  const first = firstActive(m)
  const out: Movement[] = []
  for (let i = 1; i < m.months.length; i++) {
    const month = m.months[i]
    const prevMonth = m.months[i - 1]
    let newMrr = 0, expansion = 0, contraction = 0, churn = 0, reactivation = 0
    for (const c of m.customers) {
      const cur = get(m, c, month)
      const prev = get(m, c, prevMonth)
      if (cur > 0 && prev === 0) {
        if (first.get(c) === month) newMrr += cur
        else if (zeroRunBefore(m, c, i) >= opts.reactivationGapK && activeBefore(m, c, i)) reactivation += cur
        else newMrr += cur // active-but-not-first with sub-K gap: treat as new activity
      } else if (cur > 0 && prev > 0) {
        if (cur > prev) expansion += cur - prev
        else if (cur < prev) contraction += prev - cur
      } else if (cur === 0 && prev > 0) {
        churn += prev
      }
    }
    out.push({
      month, prevMonth, newMrr, expansion, contraction, churn, reactivation,
      netNew: newMrr + expansion + reactivation - contraction - churn,
    })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/movement.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/movement.ts src/lib/engine/movement.test.ts
git commit -m "feat(engine): MRR movement bridge (new/expansion/contraction/churn/reactivation)"
```

---

## Task 8: Cohorts (dollar retention + logo survival)

**Files:**
- Create: `src/lib/engine/cohorts.ts`
- Test: `src/lib/engine/cohorts.test.ts`

Cohort = customers whose first active month equals `k0`. `dollarRetention` returns net and gross grids indexed `[cohort][age]`; `logoSurvival` returns fractions.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { cohorts } from './cohorts'
import { tx } from '../testdata'

describe('cohorts', () => {
  // Two Jan-cohort customers: a=100->120 (expansion), b=100->0 (churn month 1)
  const m = buildMatrix([
    tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'a', month: '2026-02', amountBase: 120 }),
    tx({ customerId: 'b', month: '2026-01', amountBase: 100 }),
  ], 'activity')
  const c = cohorts(m)
  const jan = c.find((x) => x.cohortMonth === '2026-01')!

  it('sizes the cohort by first-active month', () => {
    expect(jan.size).toBe(2)
  })
  it('net dollar retention credits expansion (age 1 = 120/200)', () => {
    expect(jan.netRetention[1]).toBeCloseTo(0.6)
  })
  it('gross dollar retention clamps expansion (age 1 = min(120,100)+0 / 200)', () => {
    expect(jan.grossRetention[1]).toBeCloseTo(0.5)
  })
  it('logo survival at age 1 = 1 of 2 still active', () => {
    expect(jan.logoSurvival[1]).toBeCloseTo(0.5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/cohorts.test.ts`
Expected: FAIL — cannot find './cohorts'.

- [ ] **Step 3: Write `src/lib/engine/cohorts.ts`**

```ts
import type { Matrix } from '../types'
import { get } from './matrix'
import { addMonths, monthDiff } from '../types'

export type Cohort = {
  cohortMonth: string
  size: number
  netRetention: number[] // index = age in months; [0] = 1
  grossRetention: number[]
  logoSurvival: number[]
}

function firstActiveMonth(m: Matrix, c: string): string | null {
  for (const mo of m.months) if (get(m, c, mo) !== 0) return mo
  return null
}

export function cohorts(m: Matrix): Cohort[] {
  const groups = new Map<string, string[]>() // cohortMonth -> customerIds
  for (const c of m.customers) {
    const f = firstActiveMonth(m, c)
    if (!f) continue
    const g = groups.get(f) ?? []
    g.push(c)
    groups.set(f, g)
  }
  const lastMonth = m.months[m.months.length - 1]
  const out: Cohort[] = []
  for (const [cohortMonth, members] of [...groups].sort((a, b) => monthDiff(b[0], a[0]))) { // chronological
    const maxAge = monthDiff(cohortMonth, lastMonth)
    const base = members.reduce((s, c) => s + get(m, c, cohortMonth), 0)
    const netRetention: number[] = []
    const grossRetention: number[] = []
    const logoSurvival: number[] = []
    for (let age = 0; age <= maxAge; age++) {
      const mo = addMonths(cohortMonth, age)
      let net = 0, gross = 0, active = 0
      for (const c of members) {
        const v = get(m, c, mo)
        net += v
        gross += Math.min(v, get(m, c, cohortMonth))
        if (v !== 0) active++
      }
      netRetention.push(base ? net / base : 0)
      grossRetention.push(base ? gross / base : 0)
      logoSurvival.push(members.length ? active / members.length : 0)
    }
    out.push({ cohortMonth, size: members.length, netRetention, grossRetention, logoSurvival })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/cohorts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/cohorts.ts src/lib/engine/cohorts.test.ts
git commit -m "feat(engine): revenue + logo retention cohorts"
```

---

## Task 9: Dynamic revenue bins

**Files:**
- Create: `src/lib/engine/bins.ts`
- Test: `src/lib/engine/bins.test.ts`

For a given month, place each active customer's `M[c][m]` into a `BinDef` `(min, max]`, and report per bin: customer count, revenue sum, revenue share, avg MRR, avg ACV (=avgMRR×12).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { binAnalysis } from './bins'
import { DEFAULT_BINS } from '../types'
import { tx } from '../testdata'

describe('binAnalysis', () => {
  // Jan: three customers at 100, 600, 3000
  const m = buildMatrix([
    tx({ customerId: 'a', month: '2026-01', amountBase: 100 }),
    tx({ customerId: 'b', month: '2026-01', amountBase: 600 }),
    tx({ customerId: 'c', month: '2026-01', amountBase: 3000 }),
  ], 'activity')
  const res = binAnalysis(m, '2026-01', DEFAULT_BINS)

  it('assigns each customer to the right (min,max] bin', () => {
    expect(res.bins.find((b) => b.label === 'Less than $250')!.customers).toBe(1)
    expect(res.bins.find((b) => b.label === '$501 - $1000')!.customers).toBe(1)
    expect(res.bins.find((b) => b.label === 'More than $2500')!.customers).toBe(1)
  })
  it('computes contribution share against the month total (3700)', () => {
    const top = res.bins.find((b) => b.label === 'More than $2500')!
    expect(top.revenue).toBe(3000)
    expect(top.share).toBeCloseTo(3000 / 3700)
  })
  it('computes avg MRR and avg ACV per bin', () => {
    const top = res.bins.find((b) => b.label === 'More than $2500')!
    expect(top.avgMrr).toBe(3000)
    expect(top.avgAcv).toBe(36000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/bins.test.ts`
Expected: FAIL — cannot find './bins'.

- [ ] **Step 3: Write `src/lib/engine/bins.ts`**

```ts
import type { BinDef, Matrix } from '../types'
import { get, mrrOf } from './matrix'

export type BinRow = {
  label: string
  customers: number
  revenue: number
  share: number
  avgMrr: number
  avgAcv: number
}
export type BinResult = { month: string; total: number; bins: BinRow[] }

function pick(value: number, bins: BinDef[]): number {
  // (min, max]; open top when max === null
  for (let i = 0; i < bins.length; i++) {
    const b = bins[i]
    const aboveMin = value > b.min
    const belowMax = b.max === null ? true : value <= b.max
    if (aboveMin && belowMax) return i
  }
  return -1
}

export function binAnalysis(m: Matrix, month: string, defs: BinDef[]): BinResult {
  const sums = defs.map(() => 0)
  const counts = defs.map(() => 0)
  for (const c of m.customers) {
    const v = get(m, c, month)
    if (v === 0) continue // only active customers
    const idx = pick(v, defs)
    if (idx >= 0) { sums[idx] += v; counts[idx] += 1 }
  }
  const total = mrrOf(m, month)
  const bins: BinRow[] = defs.map((d, i) => {
    const avgMrr = counts[i] ? sums[i] / counts[i] : 0
    return {
      label: d.label,
      customers: counts[i],
      revenue: sums[i],
      share: total ? sums[i] / total : 0,
      avgMrr,
      avgAcv: avgMrr * 12,
    }
  })
  return { month, total, bins }
}

/** Bin analysis for every month in the matrix (month-wise trend). */
export function binSeries(m: Matrix, defs: BinDef[]): BinResult[] {
  return m.months.map((mo) => binAnalysis(m, mo, defs))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/bins.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/bins.ts src/lib/engine/bins.test.ts
git commit -m "feat(engine): dynamic month-wise revenue bin analysis"
```

---

## Task 10: KPIs (retention rates, growth, LTV, Rule of 40)

**Files:**
- Create: `src/lib/engine/kpis.ts`
- Test: `src/lib/engine/kpis.test.ts`

Aggregate headline metrics off the matrix + movement. `null` where undefined (÷0, insufficient history) — never fabricate.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { arpa, arr, grr, nrr, momGrowth, yoyGrowth, avgLifetimeMonths, ltvRevenue } from './kpis'
import { scenario, tx } from '../testdata'

describe('kpis', () => {
  const m = buildMatrix(scenario(), 'activity')
  it('ARR is 12x MRR', () => {
    expect(arr(m, '2026-01')).toBe(3600) // 300 * 12
  })
  it('ARPA = MRR / active customers', () => {
    expect(arpa(m, '2026-01')).toBe(150) // 300 / 2
  })
  it('MoM growth Jan->Feb', () => {
    // Feb MRR = 150 (c1) + 0 (c2) + 300 (c3) = 450; Jan = 300 => +50%
    expect(momGrowth(m, '2026-02')).toBeCloseTo(0.5)
  })
  it('NRR credits expansion, GRR clamps it (Jan cohort, Jan->Feb)', () => {
    // Jan cohort {c1:100, c2:200}=300; Feb {c1:150, c2:0}=150
    expect(nrr(m, '2026-01', '2026-02')).toBeCloseTo(150 / 300)
    expect(grr(m, '2026-01', '2026-02')).toBeCloseTo((100 + 0) / 300) // min(150,100)=100, min(0,200)=0
  })
  it('YoY needs >=13 months of history => null here', () => {
    expect(yoyGrowth(m, '2026-03')).toBeNull()
  })
  it('avg lifetime and revenue LTV guard divide-by-zero', () => {
    expect(avgLifetimeMonths(0)).toBeNull()
    expect(avgLifetimeMonths(0.25)).toBe(4)
    expect(ltvRevenue(150, 0.8, 0.25)).toBeCloseTo(150 * 0.8 / 0.25)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/kpis.test.ts`
Expected: FAIL — cannot find './kpis'.

- [ ] **Step 3: Write `src/lib/engine/kpis.ts`**

```ts
import type { Matrix } from '../types'
import { get, mrrOf, activeCustomers } from './matrix'
import { addMonths, monthDiff } from '../types'

export function arr(m: Matrix, month: string): number {
  return mrrOf(m, month) * 12
}

export function arpa(m: Matrix, month: string): number | null {
  const n = activeCustomers(m, month)
  return n ? mrrOf(m, month) / n : null
}

export function momGrowth(m: Matrix, month: string): number | null {
  const prev = mrrOf(m, addMonths(month, -1))
  return prev ? (mrrOf(m, month) - prev) / prev : null
}

export function yoyGrowth(m: Matrix, month: string): number | null {
  const yearAgo = addMonths(month, -12)
  if (monthDiff(m.months[0], yearAgo) < 0) return null // insufficient history
  const prev = mrrOf(m, yearAgo)
  return prev ? (mrrOf(m, month) - prev) / prev : null
}

/** Cohort of customers active at `start`; retention to `end`. */
function startCohort(m: Matrix, start: string): string[] {
  return m.customers.filter((c) => get(m, c, start) > 0)
}

export function nrr(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  const base = cohort.reduce((s, c) => s + get(m, c, start), 0)
  if (!base) return null
  const now = cohort.reduce((s, c) => s + get(m, c, end), 0)
  return now / base
}

export function grr(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  const base = cohort.reduce((s, c) => s + get(m, c, start), 0)
  if (!base) return null
  const now = cohort.reduce((s, c) => s + Math.min(get(m, c, end), get(m, c, start)), 0)
  return now / base
}

export function logoChurnRate(m: Matrix, start: string, end: string): number | null {
  const cohort = startCohort(m, start)
  if (!cohort.length) return null
  const lost = cohort.filter((c) => get(m, c, end) === 0).length
  return lost / cohort.length
}

/** Expected lifespan in months = 1 / monthly churn rate. */
export function avgLifetimeMonths(monthlyChurnRate: number): number | null {
  return monthlyChurnRate > 0 ? 1 / monthlyChurnRate : null
}

/** Revenue LTV = ARPA * grossMargin / monthlyChurnRate. */
export function ltvRevenue(arpaMonthly: number, grossMargin: number, monthlyChurnRate: number): number | null {
  return monthlyChurnRate > 0 ? (arpaMonthly * grossMargin) / monthlyChurnRate : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/kpis.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/kpis.ts src/lib/engine/kpis.test.ts
git commit -m "feat(engine): headline KPIs (ARR/ARPA/NRR/GRR/growth/LTV)"
```

---

## Task 11: Segments (by-dimension, top-N, HHI, concentration)

**Files:**
- Create: `src/lib/engine/segments.ts`
- Test: `src/lib/engine/segments.test.ts`

Operates on `Transaction[]` (all dimension columns live there). `revenueByDimension` groups+sums; `topCustomers` ranks; `hhi` scores concentration on the 0–10,000 scale; `topNShare` is cumulative top-N%.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { revenueByDimension, topCustomers, hhi, topNShare } from './segments'
import { scenario } from '../testdata'

describe('segments', () => {
  const txs = scenario()
  it('groups revenue by a dimension and computes share', () => {
    const byRegion = revenueByDimension(txs, 'region')
    const na = byRegion.find((r) => r.key === 'NA')!
    const eu = byRegion.find((r) => r.key === 'EU')!
    expect(na.revenue).toBe(100 + 150 + 150 + 200 + 200) // c1 + c2 = 800
    expect(eu.revenue).toBe(300 + 250) // c3 = 550
    expect(na.share).toBeCloseTo(800 / 1350)
  })
  it('ranks top customers by total revenue', () => {
    // totals: c1=400, c2=400, c3=550
    const top = topCustomers(txs, 2)
    expect(top[0].customerId).toBe('c3') // 550, the largest
    expect(top[0].revenue).toBe(550)
    expect(top[1].revenue).toBe(400)
  })
  it('top-1 share and HHI reflect concentration', () => {
    // totals: c1=400, c2=400, c3=550 => total 1350
    expect(topNShare(txs, 1)).toBeCloseTo(550 / 1350)
    const shares = [400, 400, 550].map((v) => (100 * v) / 1350)
    const expected = shares.reduce((s, p) => s + p * p, 0)
    expect(hhi(txs)).toBeCloseTo(expected)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/segments.test.ts`
Expected: FAIL — cannot find './segments'.

- [ ] **Step 3: Write `src/lib/engine/segments.ts`**

```ts
import type { Transaction } from '../types'

type DimKey = 'region' | 'country' | 'businessModel' | 'currency'

export type SegmentRow = { key: string; revenue: number; share: number }

export function revenueByDimension(txs: Transaction[], dim: DimKey): SegmentRow[] {
  const sums = new Map<string, number>()
  let total = 0
  for (const t of txs) {
    const key = (t[dim] ?? 'Unknown') as string
    sums.set(key, (sums.get(key) ?? 0) + t.amountBase)
    total += t.amountBase
  }
  return [...sums.entries()]
    .map(([key, revenue]) => ({ key, revenue, share: total ? revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type CustomerTotal = { customerId: string; name: string | null; revenue: number; share: number }

function customerTotals(txs: Transaction[]): CustomerTotal[] {
  const sums = new Map<string, { name: string | null; revenue: number }>()
  let total = 0
  for (const t of txs) {
    const cur = sums.get(t.customerId) ?? { name: t.name, revenue: 0 }
    cur.revenue += t.amountBase
    sums.set(t.customerId, cur)
    total += t.amountBase
  }
  return [...sums.entries()]
    .map(([customerId, v]) => ({ customerId, name: v.name, revenue: v.revenue, share: total ? v.revenue / total : 0 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function topCustomers(txs: Transaction[], n: number): CustomerTotal[] {
  return customerTotals(txs).slice(0, n)
}

/** Cumulative revenue share of the top-N customers. */
export function topNShare(txs: Transaction[], n: number): number {
  const totals = customerTotals(txs)
  const grand = totals.reduce((s, t) => s + t.revenue, 0)
  if (!grand) return 0
  return totals.slice(0, n).reduce((s, t) => s + t.revenue, 0) / grand
}

/** Herfindahl-Hirschman index on customer revenue shares, 0..10000 scale. */
export function hhi(txs: Transaction[]): number {
  const totals = customerTotals(txs)
  const grand = totals.reduce((s, t) => s + t.revenue, 0)
  if (!grand) return 0
  return totals.reduce((s, t) => {
    const pct = (100 * t.revenue) / grand
    return s + pct * pct
  }, 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/segments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/segments.ts src/lib/engine/segments.test.ts
git commit -m "feat(engine): segmentation, top-N customers, concentration (HHI/top-N share)"
```

---

## Task 12: Customer signals (tenure, recency, dormancy, at-risk, refunds)

**Files:**
- Create: `src/lib/engine/customers.ts`
- Test: `src/lib/engine/customers.test.ts`

Per-customer CX signals. `asOf` is passed in (no `Date.now()` in the engine — keeps tests deterministic).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildMatrix } from './matrix'
import { atRisk, perCustomerRefundRate, recencyDays } from './customers'
import { tx } from '../testdata'

describe('customer signals', () => {
  it('flags a customer whose MRR declined N consecutive months', () => {
    const m = buildMatrix([
      tx({ customerId: 'd', month: '2026-01', amountBase: 300 }),
      tx({ customerId: 'd', month: '2026-02', amountBase: 200 }),
      tx({ customerId: 'd', month: '2026-03', amountBase: 100 }),
    ], 'activity')
    expect(atRisk(m, 'd', 2)).toBe(true)
    expect(atRisk(m, 'd', 3)).toBe(false) // only 2 declines observable
  })
  it('computes per-customer refund rate from signed rows', () => {
    const txs = [
      tx({ customerId: 'e', month: '2026-01', amountBase: 100, isRefund: false }),
      tx({ customerId: 'e', month: '2026-02', amountBase: -30, isRefund: true }),
    ]
    expect(perCustomerRefundRate(txs, 'e')).toBeCloseTo(30 / 100)
  })
  it('computes recency in days from a fixed as-of date', () => {
    const txs = [tx({ customerId: 'f', month: '2026-01', amountBase: 100, date: new Date(Date.UTC(2026, 0, 1)) })]
    expect(recencyDays(txs, 'f', new Date(Date.UTC(2026, 0, 31)))).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/engine/customers.test.ts`
Expected: FAIL — cannot find './customers'.

- [ ] **Step 3: Write `src/lib/engine/customers.ts`**

```ts
import type { Matrix, Transaction } from '../types'
import { get } from './matrix'

/** True if the customer's MRR strictly declined for the last `streak` transitions, all > 0. */
export function atRisk(m: Matrix, customer: string, streak: number): boolean {
  const vals = m.months.map((mo) => get(m, customer, mo))
  let declines = 0
  for (let i = vals.length - 1; i > 0; i--) {
    if (vals[i] > 0 && vals[i - 1] > 0 && vals[i] < vals[i - 1]) declines++
    else break
  }
  return declines >= streak
}

/** Refunded fraction of a customer's gross spend (uses signed refund rows). */
export function perCustomerRefundRate(txs: Transaction[], customer: string): number | null {
  let gross = 0, refunded = 0
  for (const t of txs) {
    if (t.customerId !== customer) continue
    if (t.isRefund) refunded += Math.abs(t.amountBase)
    else gross += t.amountBase
  }
  return gross > 0 ? refunded / gross : null
}

/** Days since the customer's most recent non-refund payment, relative to asOf. */
export function recencyDays(txs: Transaction[], customer: string, asOf: Date): number | null {
  const dates = txs.filter((t) => t.customerId === customer && !t.isRefund).map((t) => t.date.getTime())
  if (!dates.length) return null
  const last = Math.max(...dates)
  return Math.round((asOf.getTime() - last) / 86_400_000)
}

/** Customers with no payment within `dormancyDays` of asOf (but previously active). */
export function dormantCustomers(txs: Transaction[], asOf: Date, dormancyDays: number): string[] {
  const ids = [...new Set(txs.map((t) => t.customerId))]
  return ids.filter((c) => {
    const r = recencyDays(txs, c, asOf)
    return r !== null && r > dormancyDays
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/engine/customers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/engine/customers.ts src/lib/engine/customers.test.ts
git commit -m "feat(engine): customer CX signals (at-risk, refund rate, recency, dormancy)"
```

---

## Task 13: Full-suite green + barrel export

**Files:**
- Create: `src/lib/engine/index.ts`

- [ ] **Step 1: Write the barrel `src/lib/engine/index.ts`**

```ts
export * from './matrix'
export * from './movement'
export * from './cohorts'
export * from './bins'
export * from './kpis'
export * from './segments'
export * from './customers'
```

- [ ] **Step 2: Run the whole suite**

Run: `npx vitest run`
Expected: PASS — all task test files green (types, parse, mapping, fx, normalize, matrix, movement, cohorts, bins, kpis, segments, customers).

- [ ] **Step 3: Commit**

```bash
git add src/lib/engine/index.ts
git commit -m "feat(engine): barrel export; full engine suite green"
```

---

## Self-Review notes (coverage vs spec)

- Pipeline (spec §4): parse (T2), mapping (T3), fx (T4), normalize + data issues (T5). ✓
- Engine core (spec §5): matrix + two MRR modes (T6), movement bridge identity (T7), cohorts gross/net + logo survival (T8). ✓
- Core metrics (spec §6): Overview/Growth KPIs (T10), Segments + concentration (T11), Customers/CX (T12), Bins (T9). ✓ Remaining `core` one-liners (e.g. invoice metrics, quick ratio, new-vs-repeat split, Pareto, RFM) follow the same group-by/matrix patterns established here and are added in Plan 2's wiring or as trivial additions to these modules — each is a formula in `docs/metrics-catalog.md`.
- Refund model (spec §2, confirmed): signed rows, negative on include, dropped on exclude (T5). ✓
- Honesty (spec §6.7, §9): KPIs return `null` on ÷0 / insufficient history rather than fabricating (T10). ✓
- Not covered here (by design): all UI, controls state, charts, `nice`/`stretch` metrics → **Plan 2 (UI + remaining metrics)**.
