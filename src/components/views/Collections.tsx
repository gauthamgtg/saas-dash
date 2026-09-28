'use client'
import { useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { dailyCollections, dayKey } from '@/src/lib/planning'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CELL = 12, GAP = 3, WEEKS = 53
const LEVELS = [0.18, 0.36, 0.58, 0.8, 1] // accent mix per intensity bucket

export function Collections() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const [hover, setHover] = useState<{ k: string; v: number } | null>(null)

  const d = useMemo(() => {
    if (!txs.length) return null
    const days = dailyCollections(txs)
    let lastT = 0
    for (const t of txs) lastT = Math.max(lastT, t.date.getTime())
    const end = new Date(lastT); end.setHours(0, 0, 0, 0)
    const start = new Date(end); start.setDate(start.getDate() - (WEEKS * 7 - 1))
    start.setDate(start.getDate() - start.getDay()) // align to Sunday so each column is one week

    const cells: { k: string; v: number | undefined; x: number; y: number; month: number; date: number }[] = []
    for (let i = 0, cur = new Date(start); cur <= end; i++, cur.setDate(cur.getDate() + 1)) {
      const k = dayKey(cur)
      cells.push({ k, v: days.get(k), x: Math.floor(i / 7), y: cur.getDay(), month: cur.getMonth(), date: cur.getDate() })
    }
    const pos = cells.map((c) => c.v ?? 0).filter((v) => v > 0).sort((a, b) => a - b)
    const q = (p: number) => pos[Math.min(pos.length - 1, Math.floor(p * pos.length))] ?? 0
    const cuts = [q(0.2), q(0.4), q(0.6), q(0.8)]
    const level = (v: number) => cuts.filter((c) => v > c).length

    const monthLabels = cells.filter((c) => c.date <= 7 && c.y === 0).map((c) => ({ x: c.x, label: new Date(2000, c.month, 1).toLocaleString('en-US', { month: 'short' }) }))

    const all = [...days.entries()]
    const total = all.reduce((s, [, v]) => s + v, 0)
    const refunds = txs.reduce((s, t) => s + (t.amountBase < 0 ? -t.amountBase : 0), 0)
    const active = all.filter(([, v]) => v > 0).length
    const top = [...all].sort((a, b) => b[1] - a[1]).slice(0, 8)

    const dow = DOW.map((day) => ({ day, Collected: 0 }))
    const dom = Array.from({ length: 31 }, (_, i) => ({ day: String(i + 1), Collected: 0 }))
    for (const t of txs) {
      dow[t.date.getDay()].Collected += t.amountBase
      dom[t.date.getDate() - 1].Collected += t.amountBase
    }
    const firstWeek = dom.slice(0, 7).reduce((s, r) => s + r.Collected, 0)
    // Mon-first reads more naturally for business weeks
    const dowMon = [...dow.slice(1), dow[0]].map((r) => ({ ...r, Collected: Math.round(r.Collected) }))
    return {
      cells, level, cuts, monthLabels, total, refunds, active, top,
      dow: dowMon, dom: dom.map((r) => ({ ...r, Collected: Math.round(r.Collected) })),
      firstWeekShare: total ? firstWeek / total : null,
      weeks: cells.length ? cells[cells.length - 1].x + 1 : 0,
    }
  }, [txs])

  if (!d) return <div className="space-y-6"><ViewHeader kicker="Cash" title="Cash calendar" sub="No data in range" /></div>

  const fill = (v: number | undefined) => {
    if (v == null || v === 0) return 'var(--paper-2)'
    if (v < 0) return 'color-mix(in srgb, var(--neg) 55%, var(--paper))'
    return `color-mix(in srgb, var(--accent) ${LEVELS[d.level(v)] * 100}%, var(--paper))`
  }
  const W = d.weeks * (CELL + GAP) + 28, H = 7 * (CELL + GAP) + 18
  const fmtDay = (k: string) => new Date(`${k}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Cash" title="Cash calendar" sub="When money actually lands — every payment on a daily calendar, plus the weekday and day-of-month rhythm." />

      <div className={KSTRIP}>
        <KpiCard label="Net collected" value={fmtMoneyShort(d.total)} hint="in selected range" />
        <KpiCard label="Collection days" value={fmtNum(d.active)} hint={`avg ${fmtMoney(d.active ? d.total / d.active : null)} per day`} />
        <KpiCard label="Refunded" value={fmtMoneyShort(d.refunds)} tone={d.refunds ? 'neg' : 'default'} hint={d.total ? `${fmtPct(d.refunds / (d.total + d.refunds))} of gross` : undefined} />
        <KpiCard label="First-week share" value={fmtPct(d.firstWeekShare)} hint="collected on days 1–7" />
      </div>

      <Panel title="Daily collections" sub="Last 12 months · darker = more cash that day"
        right={<span className="text-[12.5px] tabular-nums text-ink-soft">{hover ? <><b className="text-ink">{fmtMoney(hover.v)}</b> · {fmtDay(hover.k)}</> : 'Hover a day'}</span>}>
        <div className="overflow-x-auto pb-1">
          <svg width={W} height={H} role="img" aria-label="Calendar heatmap of daily collections" onMouseLeave={() => setHover(null)}>
            {d.monthLabels.map((m) => <text key={`${m.x}${m.label}`} x={28 + m.x * (CELL + GAP)} y={10} fontSize="11" fill="var(--ink-faint)">{m.label}</text>)}
            {[1, 3, 5].map((y) => <text key={y} x={0} y={18 + y * (CELL + GAP) + CELL - 2} fontSize="10.5" fill="var(--ink-faint)">{DOW[y]}</text>)}
            {d.cells.map((c) => (
              <rect key={c.k} x={28 + c.x * (CELL + GAP)} y={18 + c.y * (CELL + GAP)} width={CELL} height={CELL} rx={3}
                fill={fill(c.v)} stroke={hover?.k === c.k ? 'var(--ink)' : 'none'} strokeWidth={1.2}
                onMouseEnter={() => setHover({ k: c.k, v: c.v ?? 0 })}>
                <title>{`${fmtDay(c.k)}: ${fmtMoney(c.v ?? 0)}`}</title>
              </rect>
            ))}
          </svg>
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11.5px] text-ink-faint">
          Less
          {[undefined, ...LEVELS].map((l, i) => (
            <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: l == null ? 'var(--paper-2)' : `color-mix(in srgb, var(--accent) ${l * 100}%, var(--paper))` }} />
          ))}
          More
          <span className="ml-3 h-3 w-3 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--neg) 55%, var(--paper))' }} /> Net refund
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="By weekday" sub="net collected">
          <BarsChart data={d.dow} xKey="day" series={[{ key: 'Collected', color: CHART.accent }]} height={220} />
        </Panel>
        <Panel title="By day of month" sub="billing-date clustering">
          <BarsChart data={d.dom} xKey="day" series={[{ key: 'Collected', color: CHART.steel }]} height={220} />
        </Panel>
      </div>

      <Panel title="Biggest collection days" sub="top 8 in range">
        <ul className="divide-y divide-line">
          {d.top.map(([k, v], i) => (
            <li key={k} className="flex items-center gap-3 py-2.5 text-[13.5px]">
              <span className="w-5 text-right text-ink-faint tabular-nums">{i + 1}</span>
              <span className="flex-1 text-ink">{fmtDay(k)}</span>
              <span className="h-1.5 w-40 overflow-hidden rounded-full bg-paper-2 max-sm:hidden">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${(v / (d.top[0]?.[1] || 1)) * 100}%` }} />
              </span>
              <span className="w-24 text-right font-semibold tabular-nums text-ink">{fmtMoney(v)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
