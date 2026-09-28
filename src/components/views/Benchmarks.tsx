'use client'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, movementSeries, quickRatio, cmgr, nrr, grr, logoChurnRate, arr } from '@/src/lib/engine'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'
import { cloud } from '@/src/lib/cloud'
import { DIMENSIONS, METRICS, arrBandKey, blendCohorts, weakestConfidence, type DimId, type MetricKey, type Confidence } from '@/src/lib/benchmarks'

const ANY = '__any__'

/** Compound a monthly rate to annual: growth (1+r)^12−1, retention r^12, churn 1−(1−r)^12. */
const annualGrowth = (r: number | null) => (r == null ? null : Math.pow(1 + r, 12) - 1)
const annualRetention = (r: number | null) => (r == null ? null : Math.pow(r, 12))
const annualChurn = (r: number | null) => (r == null ? null : 1 - Math.pow(1 - r, 12))

/** Average a monthly metric over up to the last 12 month-pairs to denoise a single month. */
function trailingAvg(months: string[], f: (start: string, end: string) => number | null): number | null {
  const vals: number[] = []
  for (let i = Math.max(1, months.length - 12); i < months.length; i++) {
    const v = f(months[i - 1], months[i])
    if (v != null) vals.push(v)
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

const CONFIDENCE: Record<Confidence, { label: string; color: string; blurb: string }> = {
  'survey-anchored': { label: 'Survey-anchored', color: 'var(--pos)', blurb: 'medians tied to published survey figures' },
  directional: { label: 'Directional', color: 'var(--warn)', blurb: 'ordering is real; exact cells inferred — no survey publishes these 5 metrics by motion' },
  illustrative: { label: 'Illustrative', color: 'var(--ink-faint)', blurb: 'qualitative patterns only — verticals aren’t published for these metrics' },
}

function Verdict({ you, median, top, higherIsBetter }: { you: number | null; median: number; top: number; higherIsBetter: boolean }) {
  if (you == null) return <span className="text-[12px] text-ink-faint font-medium">n/a</span>
  const beatsTop = higherIsBetter ? you >= top : you <= top
  const beatsMedian = higherIsBetter ? you >= median : you <= median
  const [label, color] = beatsTop ? ['Top quartile', 'var(--pos)'] : beatsMedian ? ['Above median', 'var(--pos)'] : ['Below median', 'var(--neg)']
  return (
    <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{label}</span>
  )
}

export function Benchmarks() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls.reactivationGapK])

  const last = m.months[m.months.length - 1] ?? ''
  const yourArr = arr(m, last)
  const autoBand = arrBandKey(yourArr)

  const [network, setNetwork] = useState<Awaited<ReturnType<typeof cloud.networkBenchmarks>> | null>(null)
  useEffect(() => {
    let cancelled = false
    cloud.networkBenchmarks(yourArr).then((d) => { if (!cancelled) setNetwork(d) }).catch(() => { if (!cancelled) setNetwork(null) })
    return () => { cancelled = true }
  }, [yourArr])

  const you: Record<MetricKey, number | null> = useMemo(() => ({
    growth: annualGrowth(cmgr(m)),
    nrr: annualRetention(trailingAvg(m.months, (s, e) => nrr(m, s, e))),
    grr: annualRetention(trailingAvg(m.months, (s, e) => grr(m, s, e))),
    logoChurn: annualChurn(trailingAvg(m.months, (s, e) => logoChurnRate(m, s, e))),
    quick: quickRatio(series.slice(-12)),
  }), [m, series])

  // one selection per dimension: ARR always picked (auto-detected), GTM/industry default to "Any"
  const [selByDim, setSelByDim] = useState<Record<DimId, string>>({ arr: '', type: ANY, industry: ANY })

  const picks = DIMENSIONS.map((d) => {
    const key = d.id === 'arr' ? (selByDim.arr || autoBand) : selByDim[d.id]
    const cohort = key === ANY ? null : d.cohorts.find((c) => c.key === key) ?? null
    return { dim: d, cohort }
  })
  const active = picks.filter((p): p is { dim: typeof DIMENSIONS[number]; cohort: NonNullable<typeof p.cohort> } => p.cohort != null)
  const combined = blendCohorts(active.map((a) => a.cohort))
  const conf = CONFIDENCE[weakestConfidence(active.map((a) => a.dim.confidence))]
  const sources = [...new Set(active.map((a) => a.dim.source))].join(' · ')
  const label = active.map((a) => a.cohort.label).join(' + ')

  if (!m.months.length) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">No data in range</p>

  const beats = METRICS.filter((b) => {
    const v = you[b.key], med = combined.vals[b.key].median
    return v != null && (b.higherIsBetter ? v >= med : v <= med)
  }).length

  return (
    <div className="space-y-4">
      <ViewHeader index="05" kicker="Context" title="Benchmarks"
        sub={`your trailing metrics vs public SaaS medians · ${beats}/${METRICS.length} at or above median for this combination`} />

      {/* One selector row per dimension — pick a cohort from each and they blend together */}
      <div className="space-y-2.5">
        {DIMENSIONS.map((d) => {
          const selKey = d.id === 'arr' ? (selByDim.arr || autoBand) : selByDim[d.id]
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-[12px] text-ink-faint font-medium">{d.label}</span>
              {d.optional && (
                <button onClick={() => setSelByDim((prev) => ({ ...prev, [d.id]: ANY }))}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    selKey === ANY ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-soft hover:bg-paper-2 hover:text-ink'}`}>
                  Any
                </button>
              )}
              {d.cohorts.map((c) => {
                const on = c.key === selKey
                const isYours = d.id === 'arr' && c.key === autoBand
                return (
                  <button key={c.key} onClick={() => setSelByDim((prev) => ({ ...prev, [d.id]: c.key }))}
                    className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                      on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-soft hover:bg-paper-2 hover:text-ink'}`}>
                    {c.label}{isYours && <span className={on ? 'opacity-70' : 'text-accent'}> · yours</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <Panel title={`You vs ${label}`}
        sub={`your ARR ${fmtMoneyShort(yourArr)} · metrics trailing 12 months, annualized · blended across ${active.length} selected cohort${active.length > 1 ? 's' : ''}`}
        right={
          <span title={conf.blurb} className="whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium"
            style={{ color: conf.color, background: `color-mix(in srgb, ${conf.color} 14%, transparent)` }}>{conf.label}</span>
        }
        csv={{ filename: `benchmarks-${active.map((a) => a.cohort.key).join('-')}`, rows: METRICS.map((b) => ({
          metric: b.label, you: b.fmt(you[b.key]), median: b.fmt(combined.vals[b.key].median), topQuartile: b.fmt(combined.vals[b.key].top),
        })) }}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-[12px] text-ink-soft font-medium">
                <th className="py-2 pr-3">Metric</th>
                <th className="px-3 py-2 text-right">You</th>
                <th className="px-3 py-2 text-right">Median</th>
                <th className="px-3 py-2 text-right">Top quartile</th>
                <th className="w-44 px-3 py-2">Position</th>
                <th className="px-3 py-2 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((b) => {
                const v = you[b.key]
                const { median: med, top } = combined.vals[b.key]
                const scale = top * 1.4
                const w = (x: number) => `${Math.min(100, Math.max(0, (x / scale) * 100))}%`
                const good = v != null && (b.higherIsBetter ? v >= med : v <= med)
                return (
                  <tr key={b.key} className="border-b border-line">
                    <td className="py-3 pr-3 max-w-[280px] whitespace-normal">
                      <div className="font-medium text-ink">{b.label}</div>
                      <div className="text-[11px] text-ink-faint">{b.hint}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-[15px] font-semibold tabular-nums" style={{ color: v == null ? 'var(--ink-faint)' : good ? 'var(--pos)' : 'var(--neg)' }}>{b.fmt(v)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{b.fmt(med)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-ink-soft">{b.fmt(top)}</td>
                    <td className="px-3 py-3">
                      <div className="relative h-1.5 rounded-full bg-line">
                        {v != null && <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: w(v), background: good ? 'var(--pos)' : 'var(--neg)' }} />}
                        <div title={`median ${b.fmt(med)}`} className="absolute -top-1 h-3.5 w-px bg-ink-faint" style={{ left: w(med) }} />
                        <div title={`top quartile ${b.fmt(top)}`} className="absolute -top-1 h-3.5 w-px bg-ink-faint opacity-50" style={{ left: w(top) }} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right"><Verdict you={v} median={med} top={top} higherIsBetter={b.higherIsBetter} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          <span className="font-medium text-ink-soft">{conf.label}:</span> {conf.blurb}. Sources: {sources}.
          {active.length > 1 && ' Multi-cohort figures are a simple average across the selected cuts, not a jointly-published segment.'}{' '}
          Annualization compounds trailing monthly averages, so short histories and partial months skew results. Directional context, not targets.
        </p>
      </Panel>

      <Panel title="Live peer network" sub={`ARR band ${autoBand} · anonymized public Trust pages`}>
        {!network ? (
          <p className="text-[12px] text-ink-faint tabular-nums">Loading network…</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">{network.network.note}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-line bg-paper-2 p-3">
                <div className="text-[12px] text-ink-faint font-medium">Peers</div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] tabular-nums">{fmtNum(network.network.n)}</div>
              </div>
              <div className="rounded-lg border border-line bg-paper-2 p-3">
                <div className="text-[12px] text-ink-faint font-medium">Network ARR median</div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] tabular-nums">{fmtMoneyShort(network.network.medians.arr)}</div>
              </div>
              <div className="rounded-lg border border-line bg-paper-2 p-3">
                <div className="text-[12px] text-ink-faint font-medium">Network NRR median</div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] tabular-nums">{fmtPct(network.network.medians.nrr)}</div>
              </div>
              <div className="rounded-lg border border-line bg-paper-2 p-3">
                <div className="text-[12px] text-ink-faint font-medium">Network growth median</div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] tabular-nums">{fmtPct(network.network.medians.growth)}</div>
              </div>
            </div>
            {!network.network.enough && (
              <p className="text-[11px] text-warn tabular-nums">
                Survey tables above remain the primary benchmark until ≥5 public Trust pages publish in this band.
                Publish yours from Workspace → Trust page.
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  )
}
