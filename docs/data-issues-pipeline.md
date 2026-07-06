# Data Issues Fix Pipeline — Design

## Understanding Summary

- Building an interactive data-issue fixer, replacing the read-only `IssueSummary` list, usable in the pre-Analyze Validate step *and* as a permanent "Data Issues" tab in the dashboard for revisiting later.
- Detects: existing (bad date, non-numeric amount, unknown currency) + new (missing customerId, missing/duplicate invoice-or-payment number, blank optional fields, exact duplicate rows).
- Per-row actions: Remove, inline edit (field-aware input), fill-with-value, Ignore/keep (optional fields only).
- Bulk: checkbox multi-select + "select all in category," one action applied to every selected row (bulk remove, bulk fill, or bulk re-parse with a chosen date pattern scoped to just the selection).
- Client-only, no server, no new dependencies — same architecture as the rest of the app.

## Assumptions

1. "Nota number" = invoice/payment number issues (missing or duplicated).
2. "Group changes" = the bulk/multi-select actions above, not a separate undo/version-history system.
3. Duplicate-row key = `paymentId` if present, else `(customerId, date, amountNative, currency)`.
4. Required fields (date, amount, customerId, a resolvable currency) can only be *Removed* or *Fixed* — never "Ignored" while still invalid, because `Transaction` has no null slot for those and every downstream metric assumes they're valid. Optional fields (name, country, region, businessModel, invoiceNumber) can be ignored/left blank — the type already allows null there.
5. Persist only the unresolved *issue* rows (bounded, normally a small fraction of the file), not the entire raw dataset — avoids blowing the localStorage quota on 40k+ row files. Blocking issues already carry their own raw row, so this works without keeping the full original dataset around.
6. Bad-row counts are expected in the tens-to-low-thousands; the list gets a scroll/virtualized container if long, no server-side pagination.

## Decision Log

| # | Decision | Alternatives considered | Why chosen |
|---|----------|--------------------------|------------|
| 1 | Detect 4 new issue kinds (missing customerId, missing/duplicate invoice-payment number, blank optional fields, exact duplicate rows) in addition to the 3 existing ones | Narrower scope (e.g. only add missing-customerId) | User explicitly selected all four during requirements gathering |
| 2 | Row actions: Remove / Edit / Fill / Ignore | Remove + Edit only | User explicitly selected all four |
| 3 | Bulk actions: bulk remove, bulk fill-same-value, bulk re-parse-per-selection, select-all-in-category | Bulk remove only | User explicitly selected all four |
| 4 | Fixable pre-Analyze (Validate step) *and* revisitable post-Analyze (dashboard) | Pre-Analyze only (simpler, one place) | User explicitly asked for both; accepted the larger scope |
| 5 | Revisit entry point = new dedicated "Data Issues" tab | Small persistent badge opening a modal/slide-over (recommended as lighter-weight) | User preferred a full tab over the lighter option |
| 6 | Architecture: unified `Issue` discriminated union (blocking + non-blocking), one `IssueFixer` UI reused in both placements ("Approach A") | (B) Two parallel systems — untouched `DataIssue` plus a wholly separate `Warning` system. (C) Drop pre-Analyze validation; let everything through with sentinel values, fix later. | B risks the two systems drifting out of sync over time. C creates real correctness risk for a revenue dashboard — a sentinel `$0`/epoch-date row could silently enter the metrics before being fixed. A gives one code path and is safe by construction (invalid rows structurally can't become a `Transaction`) |
| 7 | Duplicate/blank-field detection (`findWarnings`) is derived on-demand from `state.transactions`, never persisted | Store as a persisted list like blocking issues | Derived means it can never go stale after an edit; recompute cost is trivial even at 40k rows |
| 8 | Required fields can never be "Ignored" while invalid; only optional fields can | Allow "ignore" universally | `Transaction`'s required fields have no null slot — allowing ignore there would corrupt every downstream metric |
| 9 | Pre-Analyze fixes live in local `Dropzone` state (`rowOverrides`, `removedRows`), merged into raw rows before the existing `normalize()` call — no `AppContext` involvement until Analyze | Push overrides into global state immediately | Matches the existing pattern where `Dropzone` already owns mapping/currency state locally pre-Analyze; nothing is committed anywhere until the user clicks Analyze today, so fixes shouldn't be either |
| 10 | Post-Analyze fixes reuse the `raw` row already stored on each blocking `Issue` — no need to ever persist the full original dataset | Persist all `parsed.rows` so post-hoc fixes have the original data | Keeps persistence bounded (assumption 5); the only rows that ever need re-parsing are the ones that already failed and are already carrying their raw values |
| 11 | `IssueFixer` is purely presentational: `onFix(ids, patch)` doesn't know if a fix means "patch raw row + renormalize" or "patch transaction field directly" — the caller decides | Bake resolution logic into the component | Keeps one component reusable across both placements, which have genuinely different resolution mechanics underneath |
| 12 | Only one new persisted field: `dismissedWarningIds: string[]`. `state.issues` persistence is unchanged (already existed) | Also persist computed warnings | Warnings are cheap to recompute and would go stale if cached |
| 13 | Reducer actions are array-shaped (`resolveIssues`, `removeIssues`, `patchTransactions`, `removeTransactions`, `dismissWarnings`); single-row UI calls dispatch one-element arrays | Separate singular + bulk action types (10 total) | Halves the reducer surface, one code path for single and bulk |
| 14 | Extract `normalizeRow()` as the single per-row validator, used by both the bulk `normalize()` loop and the new fix-resolution path | Write a separate validation function for the "resolve one row" case | Avoids drift between bulk-parse behavior and fix-retry behavior — they must always agree |

## Final Design

### 1. Data model & detection

```ts
// src/lib/normalize.ts
type IssueBase = { id: string; reason: string }

export type BlockingIssue = IssueBase & {
  blocking: true
  rowIndex: number
  kind: 'date' | 'amount' | 'currency' | 'customerId'
  field: ColumnField
  raw: Record<string, string>       // editable — original row
}

export type BlankFieldIssue = IssueBase & {
  blocking: false
  kind: 'blank'
  field: ColumnField                 // invoiceNumber | name | country | region | businessModel
  paymentId: string                  // points at the already-valid transaction
}

export type DuplicateIdIssue = IssueBase & {
  blocking: false
  kind: 'duplicateId'
  field: 'paymentId' | 'invoiceNumber'
  paymentIds: string[]               // rows sharing the same ID value
}

export type DuplicateRowIssue = IssueBase & {
  blocking: false
  kind: 'duplicateRow'               // same customerId+date+amountNative+currency
  paymentIds: string[]
}

export type Issue = BlockingIssue | BlankFieldIssue | DuplicateIdIssue | DuplicateRowIssue
```

- `date`/`amount`/`currency`/`customerId` (blocking) → found per-row, inside normalize's existing loop (customerId check is new — today it silently defaults to `''`).
- `blank`/`duplicateId`/`duplicateRow` (non-blocking) → found by a new `findWarnings(transactions): Issue[]` in `src/lib/issues.ts`, a cheap one-pass scan run after normalize. Not stored — recomputed on demand so it can't go stale after an edit.

Blocking issues keep living in `state.issues` (persisted, as today). Warnings are derived, never persisted.

### 2. Resolution engine

Extract the per-row check out of `normalize()`'s loop into a standalone function both bulk-parse and single-row re-fix call:

```ts
// src/lib/normalize.ts
export function normalizeRow(
  raw: Record<string, string>, rowIndex: number, mapping: Mapping,
  rates: FxRates, opts: NormalizeOpts & { dateOrder: Exclude<DateOrder,'auto'> }
): { transaction: Transaction } | { issue: BlockingIssue }
```

`normalize()` becomes a thin loop calling `normalizeRow` per row. A fix/edit is: patch the raw row, call `normalizeRow` again. Success → becomes a transaction. Still bad → same issue, updated `raw`/`reason`.

Reducer actions (all array-shaped):

```ts
| { type: 'resolveIssues'; results: ({ id: string; transaction: Transaction } | { id: string; issue: Issue })[] }
| { type: 'removeIssues'; ids: string[] }
| { type: 'patchTransactions'; patches: { paymentId: string; patch: Partial<Transaction> }[] }
| { type: 'removeTransactions'; paymentIds: string[] }
| { type: 'dismissWarnings'; ids: string[] }
```

`dismissWarnings` needs `dismissedWarningIds` (section 5) so a dismissed warning doesn't resurface. All validation/detection logic stays in `src/lib` (pure, unit-testable); components call it and dispatch the result.

### 3. The IssueFixer component

```ts
type IssueFixerProps = {
  issues: Issue[]
  onFix: (ids: string[], patch: Partial<Record<ColumnField, string>>) => void
  onRemove: (ids: string[]) => void
  onDismiss?: (ids: string[]) => void   // warnings only
}
```

Layout (extends today's `IssueSummary` grouping):
- Grouped by category, same header/count-badge style as now, plus a "select all in category" checkbox per group.
- Each row: checkbox, compact raw-value display, inline actions. **Edit** expands a field-aware input — `<input type="date">` for date issues, `<input type="number">` for amounts, plain text for currency/IDs/names. **Fill** (blank-field warnings) is the same input, labeled differently. **Remove** and **Ignore** (warnings only) are one click.
- Bulk action bar appears once ≥1 row is checked: *Remove selected*, *Fill selected with [___]*, *Ignore selected* (warnings), and — only for selected date issues — *Re-parse selected as [dmy/mdy/ymd]* (today's global date-format dropdown, scoped to just the checked rows).
- Duplicate groups show members with per-row Remove, plus *Keep first, remove rest* / *Keep last, remove rest* convenience buttons.
- Scrollable `max-h-*` container; windowed/virtualized past ~200 rows.

### 4. Integration points

**Pre-Analyze (`Dropzone.tsx`):** two new local `useState`s — `rowOverrides: Record<number, Record<string,string>>` and `removedRows: Set<number>`. Merge into `parsed.rows` before calling `normalize()`. Only blocking issues apply here (no transactions exist yet for warnings to reference). No `AppContext` changes needed.

**Post-Analyze ("Data Issues" tab):** new `ViewId` member `'issues'`, new `Sidebar.tsx` entry in the Executive group with a count badge. New `src/components/views/DataIssues.tsx` (same shape as `Overview.tsx`). Computes `findWarnings(state.transactions)`, filters `dismissedWarningIds`, merges with `state.issues`, wires `IssueFixer` to the 5 reducer actions.

Both placements call the same `IssueFixer` and the same `src/lib` functions — only the caller's interpretation of `onFix` differs.

### 5. Persistence & state changes

```ts
type State = {
  // ...existing fields
  dismissedWarningIds: string[]
}
```

Persisted alongside `issues` in `persist()`/`loadFromStorage()`, same pattern as every other field. `findWarnings()` is never stored. Reducer gains the 5 new cases — plain array `map`/`filter`/`concat`, same complexity class as existing cases.

### 6. Edge cases & testing

- Self-healing by construction: fixing a row into a new collision, or removing all-but-one duplicate, resolves itself on the next `findWarnings` scan — no special-case code.
- Uniform retry rule: every fix (single or bulk) re-runs validation; nothing is force-accepted except explicit Remove/Ignore.
- Empty state: 0 issues + 0 warnings → "all clear" message in the tab; Sidebar badge hidden at 0.
- Tests: `normalize.test.ts` must keep passing unchanged (proves the `normalizeRow` extraction preserves behavior); new `normalizeRow` per-row cases; new `issues.test.ts` for `findWarnings` (blank-field, `duplicateId`, `duplicateRow`, and the size-2 threshold); reducer cases tested directly or via manual browser verification.
