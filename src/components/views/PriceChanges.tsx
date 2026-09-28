'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix } from '@/src/lib/engine'
import { median } from '@/src/lib/engine/stats'
import { planLedger, planRank, planDimension, detectPriceChanges, type PriceEvent } from '@/src/lib/pricing'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { HeatGrid, divCell } from '@/src/components/ui/HeatGrid'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmtMoney(Math.abs(n))}`
const monthName = (mo: string) => new Date(`${mo}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

function verdict(e: PriceEvent) {
  const ref = Math.max(e.baselineChurn ?? 0, e.controlChurn ?? 0)
  const churnUp = e.churnRate > ref * 1.5 + 0.02
  if (e.net < 0) return { label: 'Backfired', color: 'var(--neg)', text: `Churn cost more than the price lift: ${signed(e.net)}/mo net.` }
  if (churnUp) return { label: 'Mixed', color: 'var(--warn)', text: `Net positive (${signed(e.net)}/mo), but churn on the plan rose above its usual rate.` }
  return { label: 'Worked', color: 'var(--pos)', text: `Net ${signed(e.net)}/mo with no churn spike beyond normal levels.` }
}

function ChurnBar({ label, v, color }: { label: string; v: number | null; color: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr_48px] items-center gap-3 text-[12.5px]">
      <span className="text-ink-soft">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (v ?? 0) * 250)}%`, background: color }} /></span>
      <span className="text-right font-medium tabular-nums text-ink">{v == null ? '—' : fmtPct(v, 0)}</span>
    </div>
  )
}

export function PriceChanges() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])

  const d = useMemo(() => {
    const months = buildMatrix(txs, state.controls.mode).months
    const ledger = planLedger(txs)
    const plans = [...planRank(ledger).keys()]
    const events = detectPriceChanges(ledger, months)
    // median charge per plan per month + MoM median change among accounts staying on the plan
    const on = (plan: string, mo: string) => [...ledger.values()].flatMap((row) => { const x = row.get(mo); return x?.plan === plan ? [x.amount] : [] })
    const series = months.map((mo) => ({ month: mo, ...Object.fromEntries(plans.map((p) => [p, Math.round(median(on(p, mo)) ?? 0) || undefined])) }))
    const change = new Map<string, number | null>()
    months.forEach((mo, i) => {
      if (!i) return
      for (const p of plans) {
        const r = [...ledger.values()].flatMap((row) => { const a = row.get(months[i - 1]), b = row.get(mo); return a?.plan === p && b?.plan === p ? [b.amount / a.amount - 1] : [] })
        change.set(`${p}|${mo}`, r.length >= 2 ? median(r) : null)
      }
    })
    return { months, plans, events, series, change, dim: planDimension(txs) }
  }, [txs, state.controls.mode])

  const net = d.events.reduce((s, e) => s + e.net, 0)
  const repriced = d.events.reduce((s, e) => s + e.repriced, 0)
  const heatCols = d.months.slice(-12)

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Pricing" title="Price changes"
        sub={`Detects list-price moves from payment history — when most accounts on a ${d.dim === 'plan' ? 'plan' : 'business model'} see the same % change in one month — and measures what happened next.`} />

      <div className={KSTRIP}>
        <KpiCard label="Price changes detected" value={fmtNum(d.events.length)} hint={d.events[0] ? `latest ${monthName(d.events[0].month)}` : 'none in range'} />
        <KpiCard label="Net MRR impact" value={d.events.length ? signed(net) : '—'} tone={net > 0 ? 'pos' : net < 0 ? 'neg' : 'default'} hint="price uplift minus MRR lost to churn, 3 mo" />
        <KpiCard label="Average change" value={d.events.length ? `${fmtPct(d.events.reduce((s, e) => s + e.change, 0) / d.events.length)}` : '—'} hint="per detected change" />
        <KpiCard label="Accounts repriced" value={fmtNum(repriced)} hint="moved with the list price" />
      </div>

      {d.events.length === 0 ? (
        <Panel>
          <div className="py-10 text-center">
            <div className="text-[16px] font-semibold text-ink">No list-price changes detected</div>
            <p className="mx-auto mt-2 max-w-lg text-[13.5px] text-ink-soft">
              A change is flagged when at least 40% of accounts staying on the same {d.dim === 'plan' ? 'plan' : 'business model'} see
              their charge move by the same percentage (±1.5%) in one month. Individual upgrades or discounts don’t trigger it.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {d.events.map((e) => {
            const v = verdict(e)
            return (
              <section key={`${e.plan}${e.month}`} className="rounded-2xl border border-line bg-paper p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-navy px-2.5 py-0.5 text-[12px] font-semibold text-accent">{e.plan}</span>
                      <span className="text-[13px] text-ink-faint">{monthName(e.month)}</span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-3">
                      <span className={`text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${e.change >= 0 ? 'text-ink' : 'text-neg'}`}>{e.change >= 0 ? '+' : ''}{fmtPct(e.change)}</span>
                      <span className="text-[13px] tabular-nums text-ink-soft">{fmtMoney(e.before)} → {fmtMoney(e.after)} <span className="text-ink-faint">median charge</span></span>
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ color: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}>{v.label}</span>
                </div>

                <div className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  {[['On plan', e.exposed], ['Repriced', e.repriced], ['Churned', e.churned], ['Downgraded', e.downgraded]].map(([k, n]) => (
                    <div key={k} className="bg-paper px-3 py-2.5">
                      <div className="text-[11.5px] font-medium text-ink-soft">{k}</div>
                      <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">{n}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 space-y-2">
                  <div className="text-[12.5px] font-semibold text-ink">Churn in the {e.horizon} months after</div>
                  <ChurnBar label="This plan, after" v={e.churnRate} color={v.color} />
                  <ChurnBar label="This plan, before" v={e.baselineChurn} color="var(--ink-faint)" />
                  <ChurnBar label="Other plans, same time" v={e.controlChurn} color="var(--steel)" />
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3 text-[12.5px]">
                  <div><div className="text-ink-soft">Price uplift</div><div className="mt-0.5 text-[16px] font-semibold tabular-nums text-pos">{signed(e.uplift)}</div></div>
                  <div><div className="text-ink-soft">Lost to churn</div><div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neg">{e.lost ? `−${fmtMoney(e.lost)}` : '$0'}</div></div>
                  <div><div className="text-ink-soft">Net MRR</div><div className={`mt-0.5 text-[16px] font-semibold tabular-nums ${e.net >= 0 ? 'text-pos' : 'text-neg'}`}>{signed(e.net)}</div></div>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-[13px] text-ink-soft">
                  {v.text}{e.horizon < 3 && <span className="text-warn"> Early read — only {e.horizon} month{e.horizon === 1 ? '' : 's'} of data since the change.</span>}
                </p>
              </section>
            )
          })}
        </div>
      )}

      <Panel title="Median charge by plan" sub="What a typical account on each plan pays per month · dashed lines mark detected price changes">
        <TrendChart data={d.series} xKey="month" height={300}
          markers={d.events.map((e) => ({ month: e.month, label: `${e.plan} ${e.change >= 0 ? '+' : ''}${Math.round(e.change * 100)}%` }))}
          series={d.plans.map((p, i) => ({ key: p, color: CHART.series[i % CHART.series.length] }))} />
      </Panel>

      <Panel title="Price movement heatmap" sub="Median month-over-month change in charge for accounts staying on the same plan — a list-price change lights up a whole cell">
        <HeatGrid rows={[...d.plans].reverse()} cols={heatCols} corner={d.dim === 'plan' ? 'Plan' : 'Model'} minCol={52}
          colLabel={(c) => new Date(`${c}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' }) + (c.endsWith('-01') ? ` ’${c.slice(2, 4)}` : '')}
          cell={(p, c) => {
            const v = d.change.get(`${p}|${c}`)
            if (v == null) return null
            const hit = d.events.some((e) => e.plan === p && e.month === c)
            return { text: Math.abs(v) < 0.005 ? '0' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`, color: hit ? { bg: 'var(--accent)', fg: 'var(--accent-ink)' } : divCell(v, 0.15) }
          }}
          detail={(p, c) => {
            const e = d.events.find((x) => x.plan === p && x.month === c)
            const v = d.change.get(`${p}|${c}`)
            return e ? `${p} · ${c}: list price ${e.change >= 0 ? '+' : ''}${fmtPct(e.change)} — ${e.repriced} of ${e.exposed} accounts repriced`
              : `${p} · ${c}: median change ${v == null ? 'n/a' : fmtPct(v)} for accounts staying on the plan`
          }} />
      </Panel>

      <Callout>
        Detection needs a {d.dim === 'plan' ? 'plan' : 'business-model'} column and at least 3 accounts on the plan. Impact compares churn on the repriced plan
        with its own prior quarter and with other plans over the same window — a quick read, not a controlled experiment.
      </Callout>
    </div>
  )
}
