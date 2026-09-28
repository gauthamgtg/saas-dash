'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { planLedger, planRank, planDimension, planFlows, quarterlyMoves, type FlowKind } from '@/src/lib/pricing'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Select } from '@/src/components/ui/Select'
import { SankeyChart } from '@/src/components/ui/SankeyChart'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { HeatGrid, type Cell } from '@/src/components/ui/HeatGrid'
import { AccountProfile } from '@/src/components/ui/AccountProfile'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-5 [&>*]:border-0'
const TRACK = 'inline-flex h-8 items-center rounded-lg border border-line bg-paper-2 p-0.5'
const SEG = 'h-full rounded-[6px] px-2.5 text-[12px] font-medium transition-all'
const segCls = (on: boolean) => `${SEG} ${on ? 'bg-paper text-ink shadow-card' : 'text-ink-soft hover:text-ink'}`
const KIND_HEX: Record<FlowKind, string> = { upgrade: '#15a34a', downgrade: '#dc4a34', new: '#2563eb', churn: '#b45309', stay: '#98a29b' }
const KIND_VAR: Record<FlowKind, string> = { upgrade: '--pos', downgrade: '--neg', new: '--steel', churn: '--warn', stay: '--ink-faint' }
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${fmtMoney(Math.abs(n))}`

export function PlanMigrations() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const months = useMemo(() => buildMatrix(txs, state.controls.mode).months, [txs, state.controls.mode])
  const ledger = useMemo(() => planLedger(txs), [txs])
  const rank = useMemo(() => planRank(ledger), [ledger])
  const plans = useMemo(() => [...rank.keys()], [rank])
  const last = months[months.length - 1] ?? ''
  const [fromPick, setFrom] = useState('')
  const [toPick, setTo] = useState('')
  const [measure, setMeasure] = useState<'customers' | 'mrr'>('customers')
  const [open, setOpen] = useState<string | null>(null)
  const to = months.includes(toPick) ? toPick : last
  const from = months.includes(fromPick) && fromPick < to ? fromPick : months[Math.max(0, months.indexOf(to) - 12)] ?? ''

  const d = useMemo(() => {
    if (!from || !to || from >= to) return null
    const flows = planFlows(ledger, from, to, rank)
    const byRankDesc = [...plans].reverse()
    const left = [...byRankDesc.filter((p) => flows.some((f) => f.from === p)), ...(flows.some((f) => f.from === 'New') ? ['New'] : [])]
    const right = [...byRankDesc.filter((p) => flows.some((f) => f.to === p)), ...(flows.some((f) => f.to === 'Churned') ? ['Churned'] : [])]
    const val = (f: (typeof flows)[number]) => (measure === 'customers' ? f.customers : Math.round(f.kind === 'churn' ? f.mrrFrom : f.mrrTo))
    const linked = flows.filter((f) => val(f) > 0)
    const graph = {
      nodes: [...left, ...right].map((name) => ({ name })),
      links: linked.map((f) => ({ source: left.indexOf(f.from), target: left.length + right.indexOf(f.to), value: val(f) })),
    }
    const sum = (k: FlowKind) => flows.filter((f) => f.kind === k)
    const up = sum('upgrade'), down = sum('downgrade')
    const n = (fs: typeof flows) => fs.reduce((s, f) => s + f.customers, 0)
    const delta = (fs: typeof flows) => fs.reduce((s, f) => s + f.mrrTo - f.mrrFrom, 0)
    const stayed = n(sum('stay')), startBase = n(flows.filter((f) => f.from !== 'New'))

    // individual plan changes with the month they happened
    const names = new Map<string, string>()
    for (const t of txs) if (t.name && !names.has(t.customerId)) names.set(t.customerId, t.name)
    const span = months.slice(months.indexOf(from), months.indexOf(to) + 1)
    const moves = [...ledger].flatMap(([c, row]) => {
      const a = row.get(from), b = row.get(to)
      if (!a || !b || a.plan === b.plan) return []
      const when = span.find((mo) => row.get(mo) && row.get(mo)!.plan !== a.plan) ?? to
      const kind: FlowKind = (rank.get(b.plan) ?? 0) > (rank.get(a.plan) ?? 0) ? 'upgrade' : 'downgrade'
      return [{ c, name: names.get(c) ?? c, from: a.plan, to: b.plan, before: a.amount, after: b.amount, when, kind }]
    }).sort((x, y) => y.when.localeCompare(x.when))

    return {
      flows, linked, graph, left, right, moves,
      up: n(up), down: n(down), upMrr: delta(up), downMrr: delta(down),
      newN: n(sum('new')), churnN: n(sum('churn')), retain: startBase ? stayed / startBase : null,
      quarters: quarterlyMoves(ledger, months).map((q) => ({ quarter: q.quarter, Upgrades: Math.round(q.upMrr), Downgrades: Math.round(q.downMrr) })),
    }
  }, [ledger, rank, plans, from, to, measure, months, txs])

  const dim = planDimension(txs)
  const monthOpts = months.map((m) => ({ value: m, label: m }))
  const presets = [3, 6, 12].filter((k) => months.length > k).map((k) => ({ k, from: addMonths(to, -k) }))

  if (!d || plans.length < 2) {
    return (
      <div className="space-y-6">
        <ViewHeader kicker="Pricing" title="Plan migrations" sub={plans.length < 2 ? `Needs a ${dim === 'plan' ? 'plan' : 'business-model'} column with at least two values.` : 'Needs at least two months of data.'} />
      </div>
    )
  }

  const flowOf = (f: string, t: string) => d.flows.find((x) => x.from === f && x.to === t)
  const maxCell = Math.max(1, ...d.flows.map((f) => f.customers))
  const planColor = (name: string) => name === 'New' ? 'var(--steel)' : name === 'Churned' ? 'var(--warn)' : CHART.series[(rank.get(name) ?? 0) % CHART.series.length]

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Pricing" title="Plan migrations" sub={`Who moved between ${dim === 'plan' ? 'plans' : 'business models'}, which way, and how much MRR the moves carried.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className={TRACK}>
              {presets.map((p) => <button key={p.k} onClick={() => { setFrom(p.from); setTo(to) }} className={segCls(from === p.from)}>{p.k === 3 ? 'Quarter' : `${p.k} mo`}</button>)}
            </div>
            <Select value={from} onChange={setFrom} options={monthOpts.filter((o) => o.value < to)} />
            <span className="text-ink-faint">→</span>
            <Select value={to} onChange={setTo} options={monthOpts.filter((o) => o.value > from)} />
          </div>
        } />

      <div className={KSTRIP}>
        <KpiCard label="Upgrades" value={fmtNum(d.up)} tone={d.up ? 'pos' : 'default'} hint={`${signed(d.upMrr)} MRR`} />
        <KpiCard label="Downgrades" value={fmtNum(d.down)} tone={d.down ? 'neg' : 'default'} hint={`${signed(d.downMrr)} MRR`} />
        <KpiCard label="Net MRR from moves" value={signed(d.upMrr + d.downMrr)} tone={d.upMrr + d.downMrr >= 0 ? 'pos' : 'neg'} hint="upgrades + downgrades" />
        <KpiCard label="Stayed on plan" value={d.retain != null ? `${Math.round(d.retain * 100)}%` : '—'} hint={`of accounts paying in ${from}`} />
        <KpiCard label="New · Churned" value={`${d.newN} · ${d.churnN}`} hint="accounts in the window" />
      </div>

      <Panel title="Migration flow" sub={`${from} → ${to} · link colour = direction`}
        right={<div className={TRACK}>{(['customers', 'mrr'] as const).map((k) => <button key={k} onClick={() => setMeasure(k)} className={segCls(measure === k)}>{k === 'customers' ? 'Accounts' : 'MRR'}</button>)}</div>}>
        <SankeyChart graph={d.graph} height={Math.max(320, (Math.max(d.left.length, d.right.length)) * 70)}
          nodeColor={planColor} linkColor={(i) => KIND_HEX[d.linked[i]?.kind ?? 'stay']} />
        <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-ink-soft">
          {(['upgrade', 'downgrade', 'stay', 'new', 'churn'] as FlowKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: KIND_HEX[k], opacity: 0.7 }} />{{ upgrade: 'Upgrade', downgrade: 'Downgrade', stay: 'Stayed', new: 'New', churn: 'Churned' }[k]}</span>
          ))}
        </div>
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel title="Migration matrix" sub="Accounts by starting plan (rows) and ending plan (columns)">
          <HeatGrid rows={d.left} cols={d.right} corner="From ↓  To →" minCol={64}
            rowLabel={(r) => <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: planColor(r) }} />{r}</span>}
            cell={(r, c) => {
              const f = flowOf(r, c)
              if (!f) return null
              const t = 0.25 + (f.customers / maxCell) * 0.75
              const color: Cell = { bg: `color-mix(in srgb, var(${KIND_VAR[f.kind]}) ${Math.round(t * 80)}%, var(--paper))`, fg: t > 0.7 ? '#fff' : 'var(--ink)' }
              return { text: String(f.customers), color }
            }}
            detail={(r, c) => { const f = flowOf(r, c); return f ? `${r} → ${c}: ${f.customers} account${f.customers === 1 ? '' : 's'} · ${fmtMoney(f.mrrFrom)} → ${fmtMoney(f.mrrTo)} MRR` : `${r} → ${c}: none` }} />
        </Panel>
        <Panel title="Upgrade vs downgrade MRR by quarter" sub="MRR moved by plan changes, quarter-end to quarter-end">
          <BarsChart data={d.quarters} xKey="quarter" height={260}
            series={[{ key: 'Upgrades', color: CHART.pos }, { key: 'Downgrades', color: CHART.neg }]} />
        </Panel>
      </div>

      <Panel title="Plan changes" sub={`${d.moves.length} account${d.moves.length === 1 ? '' : 's'} changed plan between ${from} and ${to} · click for the account profile`}
        csv={{ filename: `plan-changes-${from}-${to}`, rows: d.moves.map((m) => ({ account: m.name, id: m.c, from: m.from, to: m.to, month: m.when, mrr_before: Math.round(m.before), mrr_after: Math.round(m.after), direction: m.kind })) }}>
        {d.moves.length ? (
          <table className="w-full text-[13.5px] tabular-nums">
            <thead><tr className="text-left text-[12px] text-ink-faint">
              <th className="py-2 font-medium">Account</th><th className="py-2 font-medium">Change</th><th className="py-2 font-medium">Month</th>
              <th className="py-2 text-right font-medium">MRR</th><th className="py-2 text-right font-medium">Δ</th></tr></thead>
            <tbody>
              {d.moves.map((m) => (
                <tr key={m.c} onClick={() => setOpen(m.c)} className="cursor-pointer border-t border-line transition-colors hover:bg-paper-2">
                  <td className="py-2.5 font-medium text-ink">{m.name}</td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-ink-soft">{m.from}
                      <span style={{ color: `var(${KIND_VAR[m.kind]})` }}>{m.kind === 'upgrade' ? '↗' : '↘'}</span>
                      <span className="font-medium text-ink">{m.to}</span></span>
                  </td>
                  <td className="py-2.5 text-ink-faint">{m.when}</td>
                  <td className="py-2.5 text-right text-ink-soft">{fmtMoney(m.before)} → <span className="font-medium text-ink">{fmtMoney(m.after)}</span></td>
                  <td className={`py-2.5 text-right font-semibold ${m.after >= m.before ? 'text-pos' : 'text-neg'}`}>{signed(m.after - m.before)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="py-6 text-center text-[13.5px] text-ink-faint">No plan changes in this window.</p>}
      </Panel>

      <AccountProfile customerId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
