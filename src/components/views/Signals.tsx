'use client'
import { useMemo, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from 'recharts'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf } from '@/src/lib/engine'
import { scoreAccounts, groupByCustomer, backtest, WEIGHTS, TIER_CUTS, type Kind, type Tier, type AccountScore } from '@/src/lib/signals'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { Callout } from '@/src/components/ui/Callout'
import { AccountProfile } from '@/src/components/ui/AccountProfile'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const TRACK = 'inline-flex h-8 items-center rounded-lg border border-line bg-paper-2 p-0.5'
const SEG = 'h-full rounded-[6px] px-2.5 text-[12px] font-medium transition-all'

/** Per-signal next step, so the list reads as a to-do, not just a score. */
const ACTION: Record<Kind, Record<string, string>> = {
  churn: {
    overdue: 'Check payment method & dunning, then reach out',
    momentum: 'Book a usage review with the account owner',
    streak: 'Ask what changed — seats, budget or a competitor',
    peak: 'Re-onboard: revisit the value they signed up for',
    refunds: 'Review support tickets and refund reasons',
    gaps: 'Confirm billing is set up to recur',
  },
  expansion: {
    momentum: 'Propose the next tier or an annual plan',
    streak: 'Time outreach now while usage is climbing',
    frequency: 'Offer bundled pricing for their add-ons',
    headroom: 'Upsell toward their segment’s top plan',
    reliable: 'Ask for a case study, pair it with an upgrade',
    peak: 'Lock in value with a multi-year renewal',
  },
}

const COPY: Record<Kind, { kicker: string; title: string; sub: string; hi: string; med: string; money: string; outcome: string; tone: string }> = {
  churn: {
    kicker: 'Retention', title: 'Churn early warning', tone: 'var(--neg)',
    sub: 'Accounts showing the payment patterns that come before churn — ranked, explained, with a next step.',
    hi: 'High risk', med: 'Watch', money: 'MRR at risk', outcome: 'churned',
  },
  expansion: {
    kicker: 'Growth', title: 'Expansion radar', tone: 'var(--pos)',
    sub: 'Healthy accounts whose spending looks like they are ready to grow — ranked, explained, with a play.',
    hi: 'Ready to expand', med: 'Warming up', money: 'MRR in play', outcome: 'expanded ≥10%',
  },
}
const TIER_COLOR: Record<Kind, Record<Tier, string>> = {
  churn: { high: 'var(--neg)', medium: 'var(--warn)', low: 'var(--ink-faint)' },
  expansion: { high: 'var(--pos)', medium: 'var(--steel)', low: 'var(--ink-faint)' },
}
const HEX: Record<Kind, Record<Tier, string>> = { // Recharts cells need literal colors
  churn: { high: '#dc4a34', medium: '#d97706', low: '#a3a9a4' },
  expansion: { high: '#15a34a', medium: '#2563eb', low: '#a3a9a4' },
}

function SignalsView({ kind }: { kind: Kind }) {
  const { state } = useApp()
  const c = COPY[kind]
  const [filter, setFilter] = useState<'flagged' | Tier | 'all'>('flagged')
  const [open, setOpen] = useState<string | null>(null)
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])

  const d = useMemo(() => {
    const m = buildMatrix(txs, state.controls.mode)
    if (m.months.length < 2) return null
    const by = groupByCustomer(txs)
    const asOf = new Date(Math.max(...txs.map((t) => t.date.getTime())))
    const all = scoreAccounts(m, by, m.months.length - 1, asOf)
    const score = (a: AccountScore) => (kind === 'churn' ? a.churn : a.expansion)
    const tier = (a: AccountScore) => (kind === 'churn' ? a.churnTier : a.expansionTier)
    const rows = [...all].sort((a, b) => score(b) - score(a) || b.mrr - a.mrr)
    const hi = rows.filter((a) => tier(a) === 'high'), med = rows.filter((a) => tier(a) === 'medium')
    const flaggedMrr = [...hi, ...med].reduce((s, a) => s + a.mrr, 0)
    return { rows, hi, med, flaggedMrr, total: mrrOf(m, m.months[m.months.length - 1]), score, tier, bt: backtest(m, by, kind, 3) }
  }, [txs, state.controls.mode, kind])

  if (!d) return <div className="space-y-6"><ViewHeader kicker={c.kicker} title={c.title} sub="Needs at least two months of data" /></div>

  const signalsOf = (a: AccountScore) => (kind === 'churn' ? a.churnSignals : a.expansionSignals)
  const shown = d.rows.filter((a) => filter === 'all' ? true : filter === 'flagged' ? d.tier(a) !== 'low' : d.tier(a) === filter)
  const maxMrr = Math.max(1, ...d.rows.map((a) => a.mrr))
  const bt = d.bt

  return (
    <div className="space-y-6">
      <ViewHeader kicker={c.kicker} title={c.title} sub={c.sub} />

      <div className={KSTRIP}>
        <KpiCard label={c.hi} value={fmtNum(d.hi.length)} tone={kind === 'churn' && d.hi.length ? 'neg' : d.hi.length ? 'pos' : 'default'} hint={`score ≥ ${TIER_CUTS[kind].high}`} />
        <KpiCard label={c.med} value={fmtNum(d.med.length)} hint={`score ${TIER_CUTS[kind].medium}–${TIER_CUTS[kind].high - 1}`} />
        <KpiCard label={c.money} value={fmtMoney(d.flaggedMrr)} hint={`${fmtPct(d.total ? d.flaggedMrr / d.total : null)} of current MRR`} />
        <KpiCard label="Backtest lift" value={bt?.lift != null ? `${bt.lift.toFixed(1)}×` : '—'} tone={bt?.lift != null ? (bt.lift >= 1.5 ? 'pos' : 'default') : 'default'}
          hint={bt ? `flagged accounts ${c.outcome} vs baseline` : 'needs 10+ months of history'} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_360px]">
        <Panel title="Ranked accounts" sub="Click an account for its full profile"
          csv={{ filename: `${kind}-signals`, rows: shown.map((a) => ({ account: a.name, id: a.customerId, segment: a.segment, score: d.score(a), tier: d.tier(a), mrr: Math.round(a.mrr), reasons: signalsOf(a).map((s) => s.reason).join('; '), next_step: signalsOf(a)[0] ? ACTION[kind][signalsOf(a)[0].key] : '' })) }}
          right={
            <div className={TRACK}>
              {(['flagged', 'high', 'medium', 'all'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`${SEG} ${filter === f ? 'bg-paper text-ink shadow-card' : 'text-ink-soft hover:text-ink'}`}>
                  {f === 'flagged' ? 'Flagged' : f === 'high' ? c.hi : f === 'medium' ? c.med : 'All'}
                </button>
              ))}
            </div>
          }>
          {shown.length ? (
            <ul className="-mx-2 divide-y divide-line">
              {shown.map((a, i) => {
                const sc = d.score(a), t = d.tier(a), col = TIER_COLOR[kind][t], sig = signalsOf(a)
                return (
                  <li key={a.customerId}>
                    <button onClick={() => setOpen(a.customerId)} className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-paper-2 md:grid-cols-[28px_minmax(0,1fr)_120px_96px_80px]">
                      <span className="text-right text-[12px] tabular-nums text-ink-faint">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-ink">{a.name}</span>
                          <span className="shrink-0 rounded-full px-2 py-px text-[11px] font-semibold" style={{ color: col, background: `color-mix(in srgb, ${col} 12%, transparent)` }}>
                            {t === 'high' ? c.hi : t === 'medium' ? c.med : 'Low'}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {sig.slice(0, 3).map((s) => (
                            <span key={s.key} className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-[11.5px] text-ink-soft">{s.reason}</span>
                          ))}
                          {!sig.length && <span className="text-[12px] text-ink-faint">No signals</span>}
                        </span>
                        {sig[0] && <span className="mt-1.5 block text-[12px] font-medium" style={{ color: col }}>→ {ACTION[kind][sig[0].key]}</span>}
                      </span>
                      <span className="flex items-center gap-2 max-md:hidden">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full" style={{ width: `${sc}%`, background: col }} /></span>
                        <span className="w-7 text-right text-[13px] font-semibold tabular-nums text-ink">{sc}</span>
                      </span>
                      <span className="text-right text-[13.5px] font-medium tabular-nums text-ink">{fmtMoney(a.mrr)}<span className="block text-[11px] font-normal text-ink-faint">{a.segment}</span></span>
                      <span className="flex justify-end max-md:hidden"><Sparkline data={a.spark} w={76} h={26} color={col} /></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="py-8 text-center text-[13.5px] text-ink-faint">No accounts in this tier right now.</p>}
        </Panel>

        <div className="space-y-4">
          <Panel title="Score vs MRR" sub="Top-right = biggest, most urgent">
            <div className="h-[240px] tabular-nums">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="2 5" stroke="var(--line)" />
                  <XAxis type="number" dataKey="mrr" name="MRR" tickLine={false} axisLine={false} domain={[0, Math.ceil(maxMrr / 1000) * 1000]}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
                  <YAxis type="number" dataKey="score" name="Score" domain={[0, 100]} tickLine={false} axisLine={false} width={40} />
                  <ZAxis range={[40, 40]} />
                  <ReferenceLine y={TIER_CUTS[kind].high} stroke={HEX[kind].high} strokeDasharray="4 4" strokeOpacity={0.6} />
                  <ReferenceLine y={TIER_CUTS[kind].medium} stroke={HEX[kind].medium} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                    const p = payload?.[0]?.payload as { name: string; mrr: number; score: number } | undefined
                    return p ? <div className="recharts-default-tooltip"><div className="font-semibold">{p.name}</div><div className="text-ink-soft">{fmtMoney(p.mrr)} · score {p.score}</div></div> : null
                  }} />
                  <Scatter data={d.rows.map((a) => ({ name: a.name, id: a.customerId, mrr: Math.round(a.mrr), score: d.score(a), tier: d.tier(a) }))}
                    onClick={(p: { payload?: { id: string } }) => p?.payload?.id && setOpen(p.payload.id)} className="cursor-pointer">
                    {d.rows.map((a) => <Cell key={a.customerId} fill={HEX[kind][d.tier(a)]} fillOpacity={d.tier(a) === 'low' ? 0.35 : 0.85} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="How the score works" sub="Transparent rules — points add up to the score">
            <ul className="space-y-2.5">
              {WEIGHTS[kind].map((w) => (
                <li key={w.key}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium text-ink">{w.label}</span>
                    <span className="tabular-nums text-ink-faint">up to {w.weight}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full" style={{ width: `${w.weight / 30 * 100}%`, background: c.tone, opacity: 0.7 }} /></div>
                  <p className="mt-1 text-[12px] text-ink-faint">{w.rule}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Does it work? Backtest" sub={bt ? `Scored every account as of ${bt.month} using only data up to then, then checked who ${c.outcome} by ${bt.horizon} months later` : 'Needs at least 10 months of history'}>
        {bt ? (
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              {[...bt.tiers.slice(0, 2).map((t) => ({ label: t.tier === 'high' ? c.hi : c.med, n: t.n, hits: t.hits, rate: t.rate, color: TIER_COLOR[kind][t.tier] })),
                { label: 'All flagged', n: bt.flagged.n, hits: bt.flagged.hits, rate: bt.flagged.rate, color: 'var(--ink)' },
                { label: 'Everyone (baseline)', n: bt.tiers.reduce((s, t) => s + t.n, 0), hits: bt.tiers.reduce((s, t) => s + t.hits, 0), rate: bt.baseline, color: 'var(--ink-faint)' },
              ].map((r) => (
                <div key={r.label} className="grid grid-cols-[150px_1fr_110px] items-center gap-3 text-[13px]">
                  <span className="font-medium text-ink">{r.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full transition-all" style={{ width: `${Math.max(r.rate * 100, r.n ? 1.5 : 0)}%`, background: r.color }} /></span>
                  <span className="text-right tabular-nums text-ink-soft"><b className="text-ink">{fmtPct(r.rate, 0)}</b> · {r.hits}/{r.n}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-line bg-paper-2 px-6 py-5 text-center">
              <div className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">{bt.lift != null ? `${bt.lift.toFixed(1)}×` : '—'}</div>
              <div className="mt-2 max-w-[200px] text-[12.5px] text-ink-soft">
                {bt.lift != null ? `more likely to have ${c.outcome} than the average account` : 'Nothing was flagged at that point'}
              </div>
            </div>
          </div>
        ) : <p className="text-[13.5px] text-ink-faint">Upload at least 10 months of payments to see how well these signals predicted real outcomes.</p>}
      </Panel>

      <Callout tone={kind === 'churn' ? 'warn' : 'pos'}>
        {kind === 'churn'
          ? 'Signals come from payment behaviour only — no product usage or support data. Accounts that cancel abruptly without a warning pattern won’t be caught; pair this list with your CS team’s own read.'
          : 'Expansion scores are damped for accounts that also show churn risk, so the list favours healthy, growing accounts. Payment data can’t see seat counts or usage limits — treat this as a shortlist for account managers.'}
      </Callout>

      <AccountProfile customerId={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export const ChurnWarning = () => <SignalsView kind="churn" />
export const ExpansionRadar = () => <SignalsView kind="expansion" />
