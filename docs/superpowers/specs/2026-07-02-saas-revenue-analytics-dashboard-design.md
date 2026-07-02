# SaaS Revenue Analytics Dashboard — Design

Date: 2026-07-02
Status: Approved for implementation planning

## 1. Purpose

A client-side web app where anyone uploads a transaction-level revenue export
(CSV/Excel) and gets a complete, investor-grade analytics dashboard: MRR/ARR,
cohorts, retention, revenue movement, segmentation, top customers, and
configurable revenue-bin analysis. Audiences: C-suite, founders, investors, CX,
data teams. No backend — the file never leaves the browser.

## 2. Input data

One row per payment. Expected columns (auto-detected, user-remappable):

| Column | Role |
|---|---|
| Payment ID | transaction id |
| Invoice Number | groups payments into invoices; links refunds to originals |
| Date | payment date → month bucket |
| customer_id | customer key |
| Name | display name |
| Country | fine geo |
| Region | coarse geo |
| Business Model | segment |
| Currency | native currency of the row |
| Overall Revenue | amount in native currency |
| Customer Flag | new / repeat (corroborates derived new/repeat) |
| Refund Flag | marks refund rows |

**Minimum required to run:** Date, customer_id, Overall Revenue. Everything else
is optional; views depending on an unmapped column show "column not mapped."

**Refund representation (confirmed):** refunds are **separate signed rows** with
their own Date, linkable to the original by Invoice Number. This enables refund
amount, refund rate, gross→net bridge, **and** refund-timing metrics (latency,
days-to-first-refund).

## 3. Architecture & stack

- **Next.js (App Router) + TypeScript**, deployed to **Vercel**. 100% client-side
  (`'use client'`); no API routes, DB, or auth in v1. Static export-friendly.
- **papaparse** (CSV) + **SheetJS/xlsx** (Excel) for parsing.
- **Recharts** for charts; **Tailwind** for styling (visual polish pass via the
  frontend-design skill after the engine works).
- **Vitest** for engine unit tests (the money path).
- State: React context + `useMemo`. No external state lib.
- Compute on the main thread with memoization in v1. `// ponytail:` a Web Worker
  is the upgrade path if large files stutter — not built now.

## 4. Data pipeline

`file → parse → map columns → set FX rates → normalize → transactions[] → engine → views`

1. **Parse** — file → raw rows + headers.
2. **Map** — fuzzy auto-detect columns by header name; user confirms/remaps in a
   mapping UI. Blocks until the 3 required columns are mapped.
3. **FX** — if >1 currency detected, prompt for a rate per currency → a chosen
   **base currency**. Editable later. Missing rate ⇒ totals blocked (default 1 +
   warning banner).
4. **Normalize** — produce typed `Transaction` records: parse Date → `YYYY-MM`
   month bucket, coerce Overall Revenue → number, convert to base via FX, carry
   the refund sign. Unparseable rows are quarantined into a **Data Issues** report
   (never dropped silently, never crash).

```ts
type Transaction = {
  paymentId: string
  invoiceNumber: string | null
  date: Date
  month: string            // 'YYYY-MM'
  customerId: string
  name: string | null
  country: string | null
  region: string | null
  businessModel: string | null
  currency: string | null  // native
  amountNative: number
  amountBase: number        // FX-converted
  isRefund: boolean
}
```

## 5. Analytics engine (core)

Everything derives from one structure, recomputed (memoized) whenever a global
control changes:

**`M[customerId][month] = revenue`** — the monthly customer×month revenue matrix,
in base currency, built per the active MRR mode and refund toggle. Timeline gaps
are filled with 0. "Active in month m" ⇔ `M[c][m] ≠ 0` (activity mode) or an
inferred live subscription (subscription mode).

### 5.1 Global controls (drive every view)

- **MRR model**: `Activity-based` ↔ `Subscription-inferred` (runtime toggle)
- **Include refunds**: on = net (refund rows subtracted) / off = gross (refund
  rows ignored)
- **Date range** (month window)
- **Base currency + FX rates** (set on upload, editable)
- **Filters**: Region / Country / Business Model / Currency (multi-select)
- **Bin config**: editable thresholds/labels for the Bins view (see §7)
- Tunable knobs: reactivation gap `K`, dormancy threshold `D`, at-risk streak `N`,
  gross-margin assumption for LTV, concentration-risk thresholds, whale cutoff.

### 5.2 MRR modes

- **Activity-based** — `M[c][m] = Σ` base-currency payments of `c` dated in month
  `m` (refund rows subtracted when refunds on). Active = transacted that month.
- **Subscription-inferred** — per customer, infer interval from the median gap
  between consecutive payments (≈30d→monthly, ≈90d→quarterly, ≈365d→annual, single
  payment→one-time). Amortize each payment across its inferred term (annual → /12
  over 12 months forward; monthly → that month, held until a gap signals churn;
  one-time → that month only). Smoothed recurring revenue. Documented heuristic;
  the interval thresholds are a tunable knob.

### 5.3 Revenue movement (MRR bridge) — per customer, month over month

Using the active matrix; `first(c)` = customer's earliest active month:

- **New**: `M[c][m]>0`, `M[c][m-1]=0`, and `m = first(c)`.
- **Reactivation**: `M[c][m]>0`, immediately preceded by ≥`K` zero months, and `c`
  was active before that gap.
- **Expansion**: active both months, `M[c][m] > M[c][m-1]` → `+(M[c][m]−M[c][m-1])`.
- **Contraction**: active both months, `0 < M[c][m] < M[c][m-1]` → `−(M[c][m-1]−M[c][m])`.
- **Churn**: `M[c][m-1]>0`, `M[c][m]=0` → `−M[c][m-1]`.

**Identity (unit-tested):**
`MRR[m] = MRR[m-1] + New + Reactivation + Expansion − Contraction − Churn`.

### 5.4 New vs Repeat (user definition)

A customer is **New** in the first month their revenue > 0, and **Repeat** in
every later month with revenue > 0. Derived from the matrix; Customer Flag only
corroborates.

### 5.5 Cohorts

- **Dollar-retention triangle** — rows = acquisition month (first active month),
  cols = age `t`. Net cell = `Σ_K M[c][k0+t] / Σ_K M[c][k0]`; Gross cell uses
  `min(M[c][k0+t], M[c][k0])` (expansion clamped).
- **Logo survival** — cell = active customers of cohort at age `t` ÷ cohort size.
- Cohort size = new customers by acquisition month (the row denominator).

## 6. Metric catalog

All formulas use `M` (§5), base currency, active MRR mode, and refund toggle.
`core` ships in v1; `nice`/`stretch` are documented fast-follows on the same
engine (§12). Full formulas for every metric live in `docs/metrics-catalog.md`
(generated from the research); the tables below are the v1 build list.

### 6.1 Overview
| Metric | Tier | Formula (short) |
|---|---|---|
| MRR | core | `Σ_c M[c][m]` |
| ARR | core | `12 × MRR[m]` |
| ARPA (monthly) | core | `MRR[m] / #{c: M[c][m]>0}` |
| ARR per customer | core | `12 × MRR[m] / activeCustomers[m]` |
| Gross Revenue Churn % | core | `(Churned+Contraction)/StartMRR = 1−GRR` |
| Net Revenue Churn % | core | `(Churned+Contraction−Expansion)/StartMRR = 1−NRR` |
| Logo Churn % | core | `#{start>0, end=0} / #{start>0}` |
| Avg Customer Lifetime | core | `1 / monthlyLogoChurnRate` (guard ÷0) |
| Rule of 40 — growth half | core | YoY ARR growth %; profit half shown "N/A — needs cost data" |
| Refund Rate (proxy) | core | `refunded$ / gross$` and count form |
| Gross→Net refund bridge | core | Gross − Refunds = Net (waterfall) |
| Revenue per Invoice | core | `Σ Overall Revenue_fx by Invoice Number` |
| Distinct Invoice Count | core | `count(distinct Invoice Number)` |
| Average Invoice Value | core | `totalRev / distinctInvoices` |
| Avg Payment Size | core | `totalRev / count(distinct Payment ID)` |
| Repeat Purchase Rate | core | `repeat rows / all rows` |
| Concentration-risk flag | nice | thresholds over Top-N% + HHI |
| Avg payments / invoice | nice | `distinct Payment ID / distinct Invoice Number` |

### 6.2 Growth
| Metric | Tier |
|---|---|
| New / Expansion / Contraction / Churned / Reactivation MRR | core |
| Net-New MRR & ARR | core |
| MoM growth % | core |
| YoY growth % (needs ≥13 mo) | core |
| Expansion rate, Gross MRR churn rate, Net MRR churn rate | core |
| SaaS Quick Ratio | core |
| Active customers / month | core |
| Net logo growth (adds − losses) | core |
| New logos / month | core |
| Downgrade / contraction frequency | core |
| Win-back / reactivation rate | core |
| Revenue-based LTV (gross-margin knob) | core |
| T2D3 trajectory (needs ≥2 yr) | core |
| CMGR, contraction rate, reactivation rate | nice |
| MRR movement-mix waterfall | nice |
| MRR seasonality index (needs ≥2 yr) | nice |
| Revenue volatility (CV) | nice |
| Segment concentration trend | nice |
| LTV with expansion, net-negative-churn flag, growth persistence | stretch |

### 6.3 Cohorts
| Metric | Tier |
|---|---|
| Dollar-retention triangle (gross + net) | core |
| Logo survival curves | core |
| NRR / NDR (TTM needs ≥13 mo) | core |
| GRR (TTM needs ≥13 mo) | core |
| Cohort size by acquisition month | core |
| First-purchase → repeat conversion | core |
| Initial deal-size distribution | core |
| Realized LTV by cohort, revenue survival curve | nice |
| Time-to-second-purchase, revenue-recovery "payback" proxy | nice |

### 6.4 Segments
| Metric | Tier |
|---|---|
| Revenue by Region / Country / Business Model / Currency (+dominant-currency share) | core |
| ARPA by segment | core |
| New-vs-Repeat revenue split | core |
| RFM score (revenue-based) | core |
| Segment HHI, cross-segment pivot, currency-mix trend | nice |
| Billing-frequency mix, geo-diversification, country/region count | nice |
| New-vs-repeat by segment, revenue-weighted churn, ACV proxy | nice |
| New-market entry rate | stretch |

### 6.5 Customers
| Metric | Tier |
|---|---|
| Top-N customers by revenue | core |
| Revenue per customer | core |
| Avg vs median revenue/customer + skew | core |
| Customer tenure / observed lifespan | core |
| Top-N concentration share | core |
| Per-customer refund rate | core |
| Payment recency | core |
| Dormancy / inactivity flag | core |
| At-risk: consecutive declining MRR | core |
| Refund latency, days-to-first-refund (enabled — refunds are dated rows) | core |
| Purchase frequency / cadence, cadence drift | nice |
| Reactivation-gap length, refund-free share | nice |
| Composite customer health score (tunable) | stretch |

### 6.6 Bins
The user's headline view. See §7.
| Metric | Tier |
|---|---|
| Dynamic revenue bins (per bin per month: #customers, contribution $/%, avg MRR, avg ACV) | core |
| Revenue deciles | core |
| Pareto 80/20 & 4/64 | core |
| Whale vs long-tail split | core |
| Customer revenue HHI | core |
| Segment HHI | core |
| Whale curve, revenue Gini, annualized-revenue distribution | nice |

### 6.7 Not derivable (never faked)
Shown as "N/A — needs cost data": **ARPU** (no seats), **LTV:CAC**, **CAC
payback**, **Magic Number**, **Burn Multiple**, **Rule-of-40 profit half**.

## 7. Bins view (dynamic)

Ships with the user's defaults: `≤250 · 250–500 · 500–1000 · 1000–2500 · >2500`
(contiguous edges; labels editable). The user can add/remove bins, edit
thresholds, and rename labels; everything recomputes live. Each active customer is
binned by their monthly revenue `M[c][m]`. Per bin, per month:

- **# customers** in the bin
- **Revenue contribution** — bin `Σ` and % of month total
- **Avg MRR** — bin mean of `M[c][m]`
- **Avg ACV** — `avgMRR × 12`

Rendered as a month-wise trend (stacked contribution / counts) plus a
selected-month detail table. ACV labeled "annualized run-rate," not contractual.

## 8. Views & navigation

Left **sidebar** groups the 7 views; a sticky top **control bar** holds the global
controls (MRR model, refunds, date range, base currency, filters). Views:
**Upload & Mapping**, **Overview**, **Growth**, **Cohorts**, **Segments**,
**Customers**, **Bins**.

## 9. Error handling & edge cases

- Bad rows (unparseable date/number) → Data Issues report, excluded, counted.
- Missing required column → mapping blocked.
- Multi-currency without FX rates → totals blocked, default rate 1 + warning.
- Timeline gaps → filled with 0.
- Duplicate Payment IDs → warned, kept.
- Divide-by-zero (churn=0, MRR[m-1]=0) → guarded; metric shows "—".
- Insufficient history (YoY <13 mo, T2D3/seasonality <24 mo) → view gates + labels
  "insufficient history."
- Proxy metrics carry an inline "proxy" tag with the caveat.

## 10. Data types & module layout (isolated units)

Pure functions, each unit-tested:

```
src/lib/parse.ts          file → rows + headers
src/lib/mapping.ts        auto-detect + mapping types
src/lib/fx.ts             currency detection + conversion
src/lib/normalize.ts      rows + mapping + FX + refund toggle → Transaction[]
src/lib/engine/matrix.ts      transactions + MRR mode → M[customer][month]
src/lib/engine/movement.ts    matrix → new/expansion/churn/contraction/reactivation
src/lib/engine/cohorts.ts     matrix → dollar-retention + logo-survival
src/lib/engine/bins.ts        matrix + bin config → month-wise bin analysis
src/lib/engine/segments.ts    transactions/matrix → region/model/currency, top-N, HHI, RFM
src/lib/engine/customers.ts   matrix → tenure, recency, dormancy, at-risk, refund metrics
src/lib/engine/kpis.ts        MRR/ARR/ARPA/retention/growth/LTV/rule-of-40
src/state/controls.tsx    global controls context
src/components/{layout,charts,tables}/
src/views/{Upload,Overview,Growth,Cohorts,Segments,Customers,Bins}.tsx
```

## 11. Testing

Vitest on the engine with a small synthetic payment set. Assert: matrix values,
the MRR-bridge identity (§5.3), cohort gross/net percentages, logo survival, bin
counts/contribution/avgMRR/avgACV, FX conversion, refund on/off deltas, and both
MRR modes. Engine is pure → fully testable headless.

## 12. Out of scope / fast-follow

- All `nice`/`stretch` metrics (§6) — same engine, added incrementally.
- Web Worker compute for very large files.
- Backend persistence, saved dashboards, auth, sharing.
- PDF/export of the report.
- Live FX rates.
