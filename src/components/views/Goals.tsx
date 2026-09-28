'use client'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arpa, movementSeries } from '@/src/lib/engine'
import { addMonths, monthDiff } from '@/src/lib/types'
import { requiredGrowth, monthsToTarget } from '@/src/lib/planning'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const INPUT = 'h-9 rounded-lg border border-line-strong bg-paper px-3 text-[14px] tabular-nums text-ink shadow-card outline-none focus:border-accent'
const KEY = 'ledger-goal'
const PACE_WINDOW = 6 // trailing months used for "current pace"
const plural = (n: number) => `${n} month${n === 1 ? '' : 's'}`

/** Progress ring for current vs target ARR. */
function Ring({ pct }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct))
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" aria-hidden>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="12" />
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 66 66)" style={{ transition: 'stroke-dasharray .6s cubic-bezier(.22,1,.36,1)' }} />
      <text x="66" y="63" textAnchor="middle" fontSize="24" fontWeight="600" fill="var(--ink)" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(p * 100)}%</text>
      <text x="66" y="83" textAnchor="middle" fontSize="11" fill="var(--ink-faint)">of target</text>
    </svg>
  )
}

export function Goals() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const last = m.months[m.months.length - 1] ?? ''
  const curArr = last ? mrrOf(m, last) * 12 : 0

  // Goal persists per viewer (a convenience, not shared state). Defaults: 2× ARR in 12 months.
  const [target, setTarget] = useState<number | null>(null)
  const [by, setBy] = useState('')
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(KEY) ?? 'null')
      if (g?.target && g?.by) { setTarget(g.target); setBy(g.by); return }
    } catch {}
    setTarget(Math.round((curArr * 2) / 1000) * 1000 || 1_000_000); setBy(last ? addMonths(last, 12) : '')
  }, [curArr, last])
  useEffect(() => {
    if (target && by) try { localStorage.setItem(KEY, JSON.stringify({ target, by })) } catch {}
  }, [target, by])

  const d = useMemo(() => {
    if (!last || !target || !by) return null
    const months = m.months
    const horizon = Math.max(0, monthDiff(last, by))
    const mrr = mrrOf(m, last)
    const base = months[Math.max(0, months.length - 1 - PACE_WINDOW)]
    const span = monthDiff(base, last)
    const pace = span > 0 ? requiredGrowth(mrrOf(m, base), mrr, span) : null
    const req = requiredGrowth(curArr, target, horizon)
    const eta = monthsToTarget(curArr, target, pace)
    const projected = pace != null ? curArr * Math.pow(1 + pace, horizon) : null

    const moves = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }).slice(-3)
    const avgOut = moves.length ? moves.reduce((s, mv) => s + Math.abs(mv.contraction) + Math.abs(mv.churn), 0) / moves.length : 0
    const avgIn = moves.length ? moves.reduce((s, mv) => s + mv.newMrr + mv.expansion + mv.reactivation, 0) / moves.length : 0
    const needNet = req != null ? mrr * req : null
    const needIn = needNet != null ? needNet + avgOut : null
    const a = arpa(m, last)

    const chart = [
      ...months.slice(-18).map((mo) => ({ month: mo, ARR: Math.round(mrrOf(m, mo) * 12) })),
      ...Array.from({ length: horizon }, (_, i) => {
        const n = i + 1
        return {
          month: addMonths(last, n),
          'Required path': req != null ? Math.round(curArr * Math.pow(1 + req, n)) : undefined,
          'Current pace': pace != null ? Math.round(curArr * Math.pow(1 + pace, n)) : undefined,
        }
      }),
    ]
    // anchor both projections on the last actual point so the lines connect
    const anchor = chart[Math.min(18, months.length) - 1] as Record<string, number | string | undefined>
    if (anchor) { anchor['Required path'] = Math.round(curArr); anchor['Current pace'] = Math.round(curArr) }

    const status = curArr >= target ? 'achieved' : pace != null && req != null && pace >= req ? 'on-track' : 'behind'
    return { horizon, pace, req, eta, projected, avgIn, avgOut, needNet, needIn, arpa: a, chart, status }
  }, [m, last, target, by, curArr, state.controls.reactivationGapK])

  if (!last) return <div className="space-y-6"><ViewHeader kicker="Planning" title="Goals & pacing" sub="No data in range" /></div>

  const STATUS = {
    achieved: { label: 'Target reached', color: 'var(--pos)' },
    'on-track': { label: 'On track', color: 'var(--pos)' },
    behind: { label: 'Behind pace', color: 'var(--warn)' },
  } as const
  const st = d ? STATUS[d.status as keyof typeof STATUS] : null

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Planning" title="Goals & pacing" sub="Set an ARR target and see whether today's growth rate gets you there — and what it would take." />

      <Panel>
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <Ring pct={target ? curArr / target : 0} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {st && <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>{st.label}</span>}
              <span className="text-[13px] text-ink-faint">as of {last}</span>
            </div>
            <div className="mt-2 text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">
              {fmtMoneyShort(curArr)} <span className="text-[20px] font-medium text-ink-faint">/ {fmtMoneyShort(target)} ARR</span>
            </div>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
              {d?.status === 'achieved' ? 'You have already reached this target — set a bigger one.'
                : d?.eta != null ? <>At the trailing {PACE_WINDOW}-month pace of <b className="text-ink">{fmtPct(d.pace)}</b>/mo you reach it in <b className="text-ink">{plural(d.eta)}</b> ({addMonths(last, d.eta)}), {d.eta === d.horizon ? 'right on time' : d.eta < d.horizon ? `${plural(d.horizon - d.eta)} early` : `${plural(d.eta - d.horizon)} late`}.</>
                : 'At the current pace ARR is not growing, so the target is out of reach without a change.'}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-soft">Target ARR
              <input type="number" min={0} step={10000} className={`${INPUT} w-44`} value={target ?? ''}
                onChange={(e) => setTarget(Math.max(0, Number(e.target.value)) || null)} />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-ink-soft">Target month
              <input type="month" min={addMonths(last, 1)} className={`${INPUT} w-44`} value={by} onChange={(e) => e.target.value && setBy(e.target.value)} />
            </label>
          </div>
        </div>
      </Panel>

      {d && (
        <>
          <div className={KSTRIP}>
            <KpiCard label="Required growth" value={d.req != null ? `${fmtPct(d.req)}/mo` : '—'} hint={`to hit target in ${d.horizon} mo`} />
            <KpiCard label="Current pace" value={d.pace != null ? `${fmtPct(d.pace)}/mo` : '—'} tone={d.pace != null && d.req != null ? (d.pace >= d.req ? 'pos' : 'neg') : 'default'} hint={`trailing ${PACE_WINDOW}-month CMGR`} />
            <KpiCard label={`Projected ARR · ${by}`} value={fmtMoneyShort(d.projected)} hint="if the current pace holds" />
            <KpiCard label="Gap at target date" value={d.projected != null ? fmtMoneyShort(Math.max(0, target! - d.projected)) : '—'} tone={d.projected != null && d.projected < target! ? 'neg' : 'pos'} hint="target minus projection" />
          </div>

          <Panel title="Path to target" sub="Actual ARR, the path required to hit the goal, and where the current pace lands">
            <TrendChart data={d.chart} xKey="month" height={300}
              refLines={[{ y: target!, label: `Target ${fmtMoneyShort(target)}`, color: 'var(--accent)' }]}
              series={[
                { key: 'ARR', color: CHART.accent },
                { key: 'Required path', color: CHART.warn, ghost: true },
                { key: 'Current pace', color: CHART.steel, ghost: true },
              ]} />
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Net new MRR needed" sub="next month, at the required rate">
              <div className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-ink">{fmtMoney(d.needNet)}</div>
              <p className="mt-1 text-[13px] text-ink-soft">Trailing 3-mo average: <b className="text-ink">{fmtMoney(d.avgIn - d.avgOut)}</b></p>
            </Panel>
            <Panel title="Gross new + expansion needed" sub="covers expected churn & contraction">
              <div className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-ink">{fmtMoney(d.needIn)}</div>
              <p className="mt-1 text-[13px] text-ink-soft">Assumes {fmtMoney(d.avgOut)}/mo lost, the trailing 3-mo average.</p>
            </Panel>
            <Panel title="New accounts per month" sub="if it all came from new logos at today's ARPA">
              <div className="text-[28px] font-semibold tracking-[-0.03em] tabular-nums text-ink">{d.needIn != null && d.arpa ? fmtNum(Math.ceil(d.needIn / d.arpa)) : '—'}</div>
              <p className="mt-1 text-[13px] text-ink-soft">ARPA {fmtMoney(d.arpa)} per month.</p>
            </Panel>
          </div>
          <Callout>Pacing uses compound monthly growth from payment history. It is a planning aid: seasonality, price changes and pipeline are not modelled here — see Forecast for scenarios.</Callout>
        </>
      )}
    </div>
  )
}
