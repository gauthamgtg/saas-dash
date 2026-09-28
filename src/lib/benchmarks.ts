// SaaS benchmarks synthesized from public 2023–2025 surveys — SaaS Capital, KeyBanc/KBCM +
// Sapphire, ChartMogul, OpenView/High Alpha, Benchmarkit/Maxio, Bessemer.
//
// Confidence differs by dimension and is surfaced in the UI:
//  • ARR band  — survey-anchored. Growth-by-band from Benchmarkit 2024 + OpenView/High Alpha,
//                medians pulled toward the broad ChartMogul/SaaS-Capital picture (samples diverge
//                wildly: bootstrapped ~25% vs VC-backed ~90% at <$1M). NRR/GRR from OpenView +
//                KeyBanc (which agree tightly). Logo churn derived from ChartMogul's monthly
//                customer-churn tables (small-band ~5%/mo → ~40%+/yr; enterprise low).
//  • GTM motion — directional. No major survey publishes these 5 metrics by motion; the ordering
//                (PLG grows faster/churns more, sales-led retains better) is inferred from
//                ChartMogul PLG-vs-sales growth, OpenView public-PLG, and Benchmarkit's Rule-of-40
//                by motion. Treat as shape, not exact cells.
//  • Industry  — illustrative. Vertical cuts for these metrics are effectively unpublished; these
//                encode well-known qualitative patterns (vertical SaaS sticky, infra usage-based
//                high NRR, martech churny). Directional only.
//
// Each figure is [median, topQuartile]; rates are annualized decimals, quick ratio is a ratio.
// Quick ratio is an estimate everywhere — no major survey reports it. Verdicts use median/top-Q.

export type MetricKey = 'growth' | 'nrr' | 'grr' | 'logoChurn' | 'quick'
export type Pair = { median: number; top: number }
export type Cohort = { key: string; label: string; vals: Record<MetricKey, Pair> }
export type DimId = 'arr' | 'type' | 'industry'
export type Confidence = 'survey-anchored' | 'directional' | 'illustrative'

export type MetricDef = {
  key: MetricKey
  label: string
  hint: string
  higherIsBetter: boolean
  fmt: (v: number | null) => string
}

const pct0 = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`)
const ratio = (v: number | null) => (v == null ? '—' : v.toFixed(2))

export const METRICS: MetricDef[] = [
  { key: 'growth', label: 'ARR growth (annualized)', hint: 'your CMGR compounded ×12', higherIsBetter: true, fmt: pct0 },
  { key: 'nrr', label: 'Net revenue retention', hint: 'trailing-12mo cohort, MRR-weighted', higherIsBetter: true, fmt: pct0 },
  { key: 'grr', label: 'Gross revenue retention', hint: 'trailing-12mo, no expansion credit', higherIsBetter: true, fmt: pct0 },
  { key: 'logoChurn', label: 'Logo churn (annual)', hint: 'customers lost over 12mo', higherIsBetter: false, fmt: pct0 },
  { key: 'quick', label: 'Quick ratio', hint: '(new + expansion + reactivation) ÷ (churn + contraction) — estimate', higherIsBetter: true, fmt: ratio },
]

const p = (median: number, top: number): Pair => ({ median, top })
const cohort = (key: string, label: string, g: Pair, nrr: Pair, grr: Pair, lc: Pair, q: Pair): Cohort =>
  ({ key, label, vals: { growth: g, nrr, grr, logoChurn: lc, quick: q } })

// --- By ARR band (survey-anchored) --------------------------------------------
// growth: Benchmarkit'24 <$1M 77/140, $1–5M 32/77, $5–20M 28/50, $20–50M 25/40 · medians tempered
// toward ChartMogul broad (~27–37% flat). NRR/GRR: OpenView'23 + KeyBanc'24. churn: ChartMogul monthly.
const ARR_COHORTS: Cohort[] = [
  cohort('<$1M', '< $1M ARR', p(0.42, 1.20), p(0.98, 1.08), p(0.82, 0.90), p(0.38, 0.20), p(1.5, 3.5)),
  cohort('$1–3M', '$1–3M ARR', p(0.30, 0.75), p(1.00, 1.09), p(0.86, 0.93), p(0.28, 0.14), p(1.8, 3.8)),
  cohort('$3–10M', '$3–10M ARR', p(0.28, 0.55), p(1.01, 1.10), p(0.88, 0.94), p(0.18, 0.10), p(2.0, 4.0)),
  cohort('$10–30M', '$10–30M ARR', p(0.25, 0.45), p(1.03, 1.11), p(0.90, 0.94), p(0.12, 0.07), p(2.2, 4.2)),
  cohort('>$30M', '> $30M ARR', p(0.18, 0.32), p(1.05, 1.16), p(0.91, 0.95), p(0.08, 0.04), p(2.5, 4.5)),
]

/** Map an ARR figure to the matching band key. */
export function arrBandKey(arr: number): string {
  if (arr < 1e6) return '<$1M'
  if (arr < 3e6) return '$1–3M'
  if (arr < 1e7) return '$3–10M'
  if (arr < 3e7) return '$10–30M'
  return '>$30M'
}

// --- By GTM motion (directional) ----------------------------------------------
// PLG grows fast / churns more (ChartMogul PLG new-biz 20% vs sales 0%; OpenView public-PLG 29% vs
// 21%); sales-led retains best (enterprise NRR ~118%, GRR 90%+, churn <8%). Rule-of-40 PLG 34 > 20.
const TYPE_COHORTS: Cohort[] = [
  cohort('plg', 'Self-serve / PLG', p(0.45, 0.90), p(1.00, 1.12), p(0.83, 0.91), p(0.28, 0.14), p(1.7, 3.6)),
  cohort('sales', 'Sales-led / enterprise', p(0.28, 0.50), p(1.10, 1.25), p(0.91, 0.96), p(0.07, 0.04), p(2.2, 4.2)),
  cohort('hybrid', 'Hybrid (PLG + sales)', p(0.35, 0.65), p(1.05, 1.16), p(0.88, 0.94), p(0.14, 0.08), p(2.0, 4.0)),
  cohort('smb', 'SMB / transactional', p(0.32, 0.60), p(0.97, 1.07), p(0.80, 0.88), p(0.35, 0.20), p(1.7, 3.6)),
]

// --- By industry / vertical (illustrative) ------------------------------------
// Not published for these metrics by any major survey — encodes qualitative patterns only.
const INDUSTRY_COHORTS: Cohort[] = [
  cohort('horizontal', 'Horizontal B2B SaaS', p(0.32, 0.60), p(1.02, 1.12), p(0.87, 0.93), p(0.16, 0.09), p(1.9, 3.9)),
  cohort('vertical', 'Vertical SaaS', p(0.28, 0.52), p(1.01, 1.10), p(0.91, 0.95), p(0.09, 0.05), p(2.0, 4.0)),
  cohort('infra', 'Infrastructure / Dev tools', p(0.40, 0.80), p(1.10, 1.28), p(0.89, 0.95), p(0.12, 0.06), p(2.3, 4.5)),
  cohort('fintech', 'Fintech', p(0.35, 0.70), p(1.04, 1.16), p(0.85, 0.92), p(0.14, 0.08), p(2.0, 4.0)),
  cohort('martech', 'Martech', p(0.26, 0.52), p(0.99, 1.09), p(0.82, 0.90), p(0.22, 0.12), p(1.7, 3.6)),
  cohort('security', 'Security', p(0.33, 0.66), p(1.07, 1.20), p(0.90, 0.95), p(0.09, 0.05), p(2.1, 4.2)),
]

export const DIMENSIONS: { id: DimId; label: string; cohorts: Cohort[]; confidence: Confidence; source: string; optional?: boolean }[] = [
  { id: 'arr', label: 'ARR', cohorts: ARR_COHORTS, confidence: 'survey-anchored',
    source: 'Benchmarkit/Maxio 2024, OpenView/High Alpha 2023–24, KeyBanc + Sapphire 2024, SaaS Capital 2025' },
  { id: 'type', label: 'GTM motion', cohorts: TYPE_COHORTS, confidence: 'directional', optional: true,
    source: 'inferred from ChartMogul GTM, OpenView PLG, Benchmarkit Rule-of-40 by motion (2023–25)' },
  { id: 'industry', label: 'Industry', cohorts: INDUSTRY_COHORTS, confidence: 'illustrative', optional: true,
    source: 'qualitative vertical patterns — not directly published by major surveys' },
]

const CONFIDENCE_RANK: Record<Confidence, number> = { 'survey-anchored': 0, directional: 1, illustrative: 2 }

/** Weakest (least-certain) confidence among a set of dimensions — blending in a soft cut softens the whole read. */
export function weakestConfidence(confidences: Confidence[]): Confidence {
  return confidences.reduce((worst, c) => (CONFIDENCE_RANK[c] > CONFIDENCE_RANK[worst] ? c : worst), 'survey-anchored' as Confidence)
}

/** Blend N selected cohorts into one comparison set — simple average per metric, per (median, top). */
export function blendCohorts(cohorts: Cohort[]): Cohort {
  if (cohorts.length === 1) return cohorts[0]
  const vals = {} as Record<MetricKey, Pair>
  for (const metric of METRICS) {
    const key = metric.key
    const meds = cohorts.map((c) => c.vals[key].median)
    const tops = cohorts.map((c) => c.vals[key].top)
    vals[key] = { median: meds.reduce((s, v) => s + v, 0) / meds.length, top: tops.reduce((s, v) => s + v, 0) / tops.length }
  }
  return { key: cohorts.map((c) => c.key).join('+'), label: cohorts.map((c) => c.label).join(' · '), vals }
}
