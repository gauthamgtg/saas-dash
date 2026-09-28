import Link from 'next/link'
import type { ViewId } from '@/src/state/AppContext'
import { NAV_ITEMS } from '@/src/lib/nav'
import { flag } from '@/src/lib/flags'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'
import { CHART } from '@/src/lib/theme'
import { LandingMap } from './islands'
import type { LandingData } from './data'

// Server-rendered mini versions of the dashboard views, all fed by landingData().

const mix = (v: string, pct: number) => `color-mix(in srgb, var(${v}) ${Math.round(pct)}%, var(--paper))`
const clamp = (x: number) => Math.max(0, Math.min(1, x))

function Tile({ eyebrow, title, body, view, className = '', children }: {
  eyebrow: string; title: string; body: string; view: ViewId; className?: string; children: React.ReactNode
}) {
  return (
    <article className={`group flex min-w-0 flex-col rounded-2xl border border-line bg-paper p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-pop ${className}`}>
      <div className="text-[12px] font-semibold text-accent">{eyebrow}</div>
      <h3 className="mt-1 text-[16.5px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-5 flex-1">{children}</div>
      <Link href={`/app?demo=1&view=${view}`} className="mt-5 inline-flex w-fit items-center gap-1 text-[13px] font-medium text-accent opacity-80 transition-opacity group-hover:opacity-100">
        Open in demo <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </Link>
    </article>
  )
}

function Group({ kicker, title, children }: { kicker: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-20 first:mt-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-accent">{kicker}</div>
          <h3 className="mt-1 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-tight tracking-[-0.035em] text-ink">{title}</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">{children}</div>
    </div>
  )
}

function Spark({ data, color = 'var(--accent)', w = 90, h = 28 }: { data: number[]; color?: string; w?: number; h?: number }) {
  const pts = data.filter(Number.isFinite)
  if (pts.length < 2) return null
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(' ')
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ maxWidth: '100%', height: 'auto' }} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" /></svg>
}

// ── Revenue ────────────────────────────────────────────────────────────────
function Bridge({ b }: { b: LandingData['bridge'] }) {
  const steps = [
    { k: 'Opening', v: b.open, kind: 'total' }, { k: 'New', v: b.newMrr, kind: 'up' }, { k: 'Expansion', v: b.expansion, kind: 'up' },
    { k: 'Reactivated', v: b.reactivation, kind: 'up' }, { k: 'Contraction', v: -b.contraction, kind: 'down' }, { k: 'Churn', v: -b.churn, kind: 'down' },
    { k: 'Closing', v: b.close, kind: 'total' },
  ]
  const W = 560, H = 190, top = 22, bottom = 26, bw = 52, gap = (W - steps.length * bw) / (steps.length - 1)
  const max = b.open + b.newMrr + b.expansion + b.reactivation
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom)
  let run = 0
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="MRR bridge">
      {steps.map((s, i) => {
        const x = i * (bw + gap)
        const [lo, hi] = s.kind === 'total' ? [0, s.v] : s.v >= 0 ? [run, run + s.v] : [run + s.v, run]
        if (s.kind === 'total') run = s.v; else run += s.v
        const fill = s.kind === 'total' ? 'var(--accent)' : s.kind === 'up' ? mix('--pos', 70) : mix('--neg', 70)
        return (
          <g key={s.k}>
            <rect x={x} y={y(hi)} width={bw} height={Math.max(2, y(lo) - y(hi))} rx={5} fill={fill} className="rise" style={{ animationDelay: `${i * 60}ms` }} />
            {i < steps.length - 1 && <line x1={x + bw} x2={x + bw + gap} y1={y(run)} y2={y(run)} stroke="var(--line-strong)" strokeDasharray="3 3" />}
            <text x={x + bw / 2} y={y(hi) - 6} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--ink)">{s.kind === 'total' ? fmtMoneyShort(s.v) : `${s.v >= 0 ? '+' : '−'}${fmtMoneyShort(Math.abs(s.v))}`}</text>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--ink-faint)">{s.k}</text>
          </g>
        )
      })}
    </svg>
  )
}

function CohortGrid({ rows }: { rows: LandingData['cohortGrid'] }) {
  return (
    <table className="w-full border-separate text-[11px] tabular-nums" style={{ borderSpacing: 3 }}>
      <thead><tr><th className="text-left font-medium text-ink-faint">Cohort</th>{Array.from({ length: 7 }, (_, i) => <th key={i} className="font-medium text-ink-faint">M{i}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.month}>
            <td className="whitespace-nowrap pr-1 font-medium text-ink-soft">{new Date(`${r.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</td>
            {Array.from({ length: 7 }, (_, i) => {
              const v = r.nrr[i]
              const t = v == null ? null : clamp((v - 0.5) / 0.7)
              return <td key={i} className="h-6 rounded-[5px] text-center font-medium"
                style={{ background: t == null ? 'var(--paper-2)' : mix('--accent', 10 + t * 80), color: t != null && t > 0.6 ? '#fff' : 'var(--ink)' }}>
                {v == null ? '' : Math.round(v * 100)}
              </td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Forecast({ f }: { f: LandingData['forecast'] }) {
  const W = 420, H = 160
  const all = [...f.history, ...f.cone.map((p) => p.hi)]
  const max = Math.max(...all) * 1.05, min = Math.min(...f.history) * 0.9
  const n = f.history.length + f.cone.length
  const x = (i: number) => (i / (n - 1)) * W, y = (v: number) => H - ((v - min) / (max - min)) * H
  const hist = f.history.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const o = f.history.length - 1
  const upper = f.cone.map((p, i) => `L${x(o + 1 + i)},${y(p.hi)}`).join(' ')
  const lower = [...f.cone].reverse().map((p, i) => `L${x(o + f.cone.length - i)},${y(p.lo)}`).join(' ')
  const proj = `M${x(o)},${y(f.history[o])} ` + f.cone.map((p, i) => `L${x(o + 1 + i)},${y(p.projected)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-label="Forecast cone" role="img">
      <path d={`M${x(o)},${y(f.history[o])} ${upper} ${lower} Z`} fill={mix('--steel', 18)} />
      <path d={hist} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" className="draw" />
      <path d={proj} fill="none" stroke="var(--steel)" strokeWidth={2} strokeDasharray="5 5" />
      <line x1={x(o)} x2={x(o)} y1={0} y2={H} stroke="var(--line-strong)" strokeDasharray="2 4" />
      <text x={x(o) + 6} y={14} fontSize="11" fill="var(--ink-faint)">forecast →</text>
    </svg>
  )
}

const SEV: Record<string, string> = { critical: '--neg', warn: '--warn', info: '--steel' }
function Alerts({ items }: { items: LandingData['alerts'] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3 rounded-xl border border-line p-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: `var(${SEV[a.severity] ?? '--ink-faint'})` }} />
          <div className="min-w-0"><div className="truncate text-[13.5px] font-medium text-ink">{a.title}</div><div className="line-clamp-1 text-[12px] text-ink-faint">{a.detail}</div></div>
        </li>
      ))}
    </ul>
  )
}

// ── Accounts ───────────────────────────────────────────────────────────────
function SignalList({ rows, tone }: { rows: LandingData['churnTop']; tone: '--neg' | '--pos' }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
            <span className="truncate font-medium text-ink">{r.name}</span>
            <span className="shrink-0 tabular-nums text-ink-faint">{fmtMoney(r.mrr)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full" style={{ width: `${r.score}%`, background: `var(${tone})` }} /></span>
            <span className="w-6 text-right text-[12px] font-semibold tabular-nums text-ink">{r.score}</span>
          </div>
          {r.reason && <div className="mt-1 truncate text-[12px] text-ink-soft">{r.reason}</div>}
        </li>
      ))}
    </ul>
  )
}

function Account({ a }: { a: LandingData['account'] }) {
  const label: Record<string, string> = { new: 'New', expansion: 'Expansion', reactivation: 'Reactivated', contraction: 'Downgrade', churn: 'Churned' }
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl text-[16px] font-semibold text-white" style={{ background: CHART.series[1] }}>{a.name.slice(0, 1)}</span>
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold text-ink">{a.name}</div>
          <div className="text-[12px] text-ink-faint">{[a.plan, a.country].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold text-pos" style={{ background: mix('--pos', 12) }}>Active</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div><div className="text-[11.5px] text-ink-soft">Current MRR</div><div className="text-[20px] font-semibold tabular-nums tracking-[-0.03em] text-ink">{fmtMoney(a.mrr)}</div></div>
        <Spark data={a.spark} w={110} h={34} color={CHART.series[1]} />
      </div>
      <ol className="mt-4 space-y-1.5 border-l border-line pl-3 text-[12.5px]">
        {a.events.map((e, i) => (
          <li key={i} className="flex justify-between gap-2"><span className="text-ink-soft">{label[e.type]} · {e.month}</span><span className={`font-medium tabular-nums ${e.amount >= 0 ? 'text-pos' : 'text-neg'}`}>{e.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(e.amount))}</span></li>
        ))}
      </ol>
    </div>
  )
}

// ── Pricing & markets ──────────────────────────────────────────────────────
function Flow({ flows, plans }: { flows: LandingData['flows']; plans: string[] }) {
  const left = [...plans.filter((p) => flows.some((f) => f.from === p)), ...(flows.some((f) => f.from === 'New') ? ['New'] : [])]
  const right = [...plans.filter((p) => flows.some((f) => f.to === p)), ...(flows.some((f) => f.to === 'Churned') ? ['Churned'] : [])]
  const W = 460, H = 220, nw = 9, gap = 8, lx = 86, rx = W - 86 - nw
  const total = flows.reduce((s, f) => s + f.customers, 0) || 1
  const scale = (H - gap * (Math.max(left.length, right.length) - 1)) / total
  const layout = (names: string[], side: 'from' | 'to') => {
    let yy = 0
    return new Map(names.map((n) => { const h = flows.filter((f) => f[side] === n).reduce((s, f) => s + f.customers, 0) * scale; const r = { y: yy, h, off: 0 }; yy += h + gap; return [n, r] }))
  }
  const L = layout(left, 'from'), R = layout(right, 'to')
  const color = (k: string) => ({ upgrade: 'var(--pos)', downgrade: 'var(--neg)', new: 'var(--steel)', churn: 'var(--warn)', stay: 'var(--ink-faint)' }[k] ?? 'var(--ink-faint)')
  const nodeColor = (n: string) => (n === 'New' ? 'var(--steel)' : n === 'Churned' ? 'var(--warn)' : 'var(--accent)')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Plan migration flow">
      {[...flows].sort((a, b) => left.indexOf(a.from) - left.indexOf(b.from) || right.indexOf(a.to) - right.indexOf(b.to)).map((f, i) => {
        const a = L.get(f.from)!, b = R.get(f.to)!, h = f.customers * scale
        const y0 = a.y + a.off, y1 = b.y + b.off; a.off += h; b.off += h
        const x0 = lx + nw, x1 = rx, mid = (x0 + x1) / 2
        return <path key={i} d={`M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} L${x1},${y1 + h} C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h} Z`}
          fill={color(f.kind)} fillOpacity={f.kind === 'stay' ? 0.18 : 0.38} />
      })}
      {[...L].map(([n, r]) => <g key={`l${n}`}><rect x={lx} y={r.y} width={nw} height={r.h} rx={3} fill={nodeColor(n)} /><text x={lx - 8} y={r.y + r.h / 2 + 4} textAnchor="end" fontSize="11.5" fill="var(--ink)">{n}</text></g>)}
      {[...R].map(([n, r]) => <g key={`r${n}`}><rect x={rx} y={r.y} width={nw} height={r.h} rx={3} fill={nodeColor(n)} /><text x={rx + nw + 8} y={r.y + r.h / 2 + 4} fontSize="11.5" fill="var(--ink)">{n}</text></g>)}
    </svg>
  )
}

function Cash({ cells, max }: { cells: LandingData['cash']; max: number }) {
  const S = 13, G = 3, cols = Math.max(...cells.map((c) => c.x)) + 1
  return (
    <svg viewBox={`0 0 ${cols * (S + G)} ${7 * (S + G)}`} className="h-auto w-full" role="img" aria-label="Daily collections calendar">
      {cells.map((c, i) => <rect key={i} x={c.x * (S + G)} y={c.y * (S + G)} width={S} height={S} rx={3}
        fill={c.v > 0 ? mix('--accent', 18 + (c.v / max) * 82) : c.v < 0 ? mix('--neg', 55) : 'var(--paper-2)'} />)}
    </svg>
  )
}

// ── Reporting ──────────────────────────────────────────────────────────────
function Ring({ pct }: { pct: number }) {
  const r = 46, c = 2 * Math.PI * r, p = clamp(pct)
  return (
    <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden>
      <circle cx="58" cy="58" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="11" />
      <circle cx="58" cy="58" r={r} fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 58 58)" />
      <text x="58" y="56" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--ink)">{Math.round(p * 100)}%</text>
      <text x="58" y="74" textAnchor="middle" fontSize="10.5" fill="var(--ink-faint)">of target</text>
    </svg>
  )
}

export function Showcase({ d }: { d: LandingData }) {
  const grow = (d.update.mrr - d.update.pMrr) / (d.update.pMrr || 1)
  return (
    <section id="features" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
      <div className="max-w-2xl">
        <div className="text-[13px] font-semibold text-accent">A tour, with real numbers</div>
        <h2 className="mt-2 text-[clamp(2rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink">
          Everything below is <span className="font-serif font-normal italic text-accent">live from the sample data.</span>
        </h2>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">Every card is a small version of a dashboard view. Open any of them to explore it in the demo.</p>
      </div>

      <div className="mt-12">
        <Group kicker="Revenue, explained" title="Where every dollar of MRR came from">
          <Tile className="md:col-span-4" view="arrbridge" eyebrow="ARR bridge" title="12-month MRR bridge"
            body={`From ${fmtMoneyShort(d.bridge.open)} to ${fmtMoneyShort(d.bridge.close)} — new, expansion, reactivation, contraction and churn, reconciled.`}>
            <Bridge b={d.bridge} />
          </Tile>
          <Tile className="md:col-span-2" view="cohorts" eyebrow="Cohorts" title="Net retention by cohort" body="Each signup month, tracked by age. Above 100 means the cohort grew.">
            <CohortGrid rows={d.cohortGrid} />
          </Tile>
          <Tile className="md:col-span-3" view="forecast" eyebrow="Forecast" title="Six months out, with a cone" body="Run-rate projection from trailing growth, plus editable bear / base / bull scenarios.">
            <Forecast f={d.forecast} />
          </Tile>
          <Tile className="md:col-span-3" view="alerts" eyebrow="Alerts" title="It tells you what changed" body="Rule-based checks flag churn spikes, concentration and slowing growth.">
            <Alerts items={d.alerts} />
          </Tile>
        </Group>

        <Group kicker="Accounts that need you" title="Who’s about to leave, and who’s ready to grow">
          <Tile className="md:col-span-2" view="churnwarn" eyebrow="Churn warning" title="Early-warning scores" body="Overdue payments, shrinking spend and refunds — ranked, each with a reason.">
            <SignalList rows={d.churnTop} tone="--neg" />
          </Tile>
          <Tile className="md:col-span-2" view="expansion" eyebrow="Expansion radar" title="Upsell shortlist" body="Healthy accounts whose spending pattern looks ready for the next tier.">
            <SignalList rows={d.expansionTop} tone="--pos" />
          </Tile>
          <Tile className="md:col-span-2" view="customers" eyebrow="Account 360" title="Every account, in one drawer" body="MRR history, revenue timeline and payments for any customer.">
            <Account a={d.account} />
          </Tile>
        </Group>

        <Group kicker="Pricing & markets" title="Where you sell, and what your prices did">
          <Tile className="md:col-span-4" view="geo" eyebrow="Markets" title="A real world map of your revenue" body={`${d.marketCount} markets · ${fmtPct(d.fx.foreignShare, 0)} of MRR billed outside ${d.fx.base ?? 'base currency'}.`}>
            <LandingMap rows={d.map} />
            <div className="mt-3 flex flex-wrap gap-2">
              {d.markets.map((r) => (
                <span key={r.key} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[12px] tabular-nums text-ink-soft">
                  <span>{flag(r.key)}</span><span className="font-medium text-ink">{r.key}</span>{fmtPct(r.share, 0)}
                  {r.growth != null && <span className={r.growth >= 0 ? 'text-pos' : 'text-neg'}>{r.growth >= 0 ? '↑' : '↓'}{fmtPct(Math.abs(r.growth), 1)}</span>}
                </span>
              ))}
            </div>
          </Tile>
          <Tile className="md:col-span-2" view="pricing" eyebrow="Price changes" title="List-price moves, detected" body="Spotted from payment history, then judged on churn and net MRR.">
            <div className="space-y-3">
              {d.priceEvents.map((e) => {
                const good = e.net >= 0
                return (
                  <div key={e.plan + e.month} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-navy px-2 py-0.5 text-[11.5px] font-semibold text-accent">{e.plan}</span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: `var(${good ? '--pos' : '--neg'})`, background: mix(good ? '--pos' : '--neg', 12) }}>{good ? 'Worked' : 'Backfired'}</span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-ink">+{fmtPct(e.change, 0)}</span>
                      <span className="text-[12px] text-ink-faint">{e.month}</span>
                    </div>
                    <div className={`text-[12.5px] font-medium tabular-nums ${good ? 'text-pos' : 'text-neg'}`}>{good ? '+' : '−'}{fmtMoney(Math.abs(e.net))}/mo net · {e.churned} churned</div>
                  </div>
                )
              })}
            </div>
          </Tile>
          <Tile className="md:col-span-3" view="migrations" eyebrow="Plan migrations" title="Who moved between plans" body="Where last year’s accounts ended up: upgraded, downgraded, stayed or churned.">
            <Flow flows={d.flows} plans={d.plans} />
          </Tile>
          <Tile className="md:col-span-3" view="collections" eyebrow="Cash calendar" title="When money actually lands" body="Every payment on a daily calendar, plus weekday and day-of-month rhythm.">
            <Cash cells={d.cash} max={d.cashMax} />
            <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-ink-faint">Less {[18, 45, 70, 100].map((p) => <span key={p} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: mix('--accent', p) }} />)} More</div>
          </Tile>
        </Group>

        <Group kicker="Reporting that writes itself" title="From numbers to the update your investors read">
          <Tile className="md:col-span-3" view="update" eyebrow="Investor update" title="Drafted from your metrics" body="Pick a month, add highlights and asks, copy as Markdown.">
            <div className="rounded-xl border border-line bg-bone p-5">
              <div className="text-[11.5px] font-semibold text-accent">{new Date(`${d.update.month}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
              <div className="mt-0.5 font-serif text-[26px] leading-tight text-ink">Your company update</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">MRR {grow >= 0 ? 'grew' : 'declined'} to <b className="text-ink">{fmtMoney(d.update.mrr)}</b> ({grow >= 0 ? '+' : '−'}{fmtPct(Math.abs(grow))} MoM), an annual run-rate of <b className="text-ink">{fmtMoneyShort(d.update.mrr * 12)}</b>.</p>
              <div className="mt-3 space-y-1.5 text-[12.5px] tabular-nums">
                {d.metrics.slice(3, 7).map(([k, v]) => <div key={k} className="flex justify-between border-t border-line pt-1.5"><span className="text-ink-soft">{k}</span><span className="font-semibold text-ink">{v}</span></div>)}
              </div>
            </div>
          </Tile>
          <Tile className="md:col-span-3" view="goals" eyebrow="Goals & pacing" title={`Path to ${fmtMoneyShort(d.goal.target)} ARR`} body="Set a target and see if today’s growth rate gets you there — and what it takes.">
            <div className="flex items-center gap-6">
              <Ring pct={d.goal.curArr / d.goal.target} />
              <dl className="flex-1 space-y-3 text-[13px]">
                <div><dt className="text-ink-soft">Needed</dt><dd className="text-[20px] font-semibold tabular-nums tracking-[-0.03em] text-ink">{fmtPct(d.goal.need)}<span className="text-[13px] font-normal text-ink-faint">/mo</span></dd></div>
                <div><dt className="text-ink-soft">Current pace</dt><dd className={`text-[20px] font-semibold tabular-nums tracking-[-0.03em] ${d.goal.pace != null && d.goal.need != null && d.goal.pace >= d.goal.need ? 'text-pos' : 'text-warn'}`}>{fmtPct(d.goal.pace)}<span className="text-[13px] font-normal text-ink-faint">/mo</span></dd></div>
              </dl>
            </div>
          </Tile>
          <Tile className="md:col-span-3" view="board" eyebrow="Board pack & present" title="A deck-ready view in one click" body="Full-screen present mode, share links that carry the data, and export to PDF.">
            <div className="rounded-xl border border-line bg-ink p-4 text-bone">
              <div className="flex items-center justify-between text-[11px] opacity-60"><span>Board pack · {d.last}</span><span>1 / 6</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {d.metrics.slice(0, 3).map(([k, v]) => <div key={k} className="rounded-lg bg-white/5 p-2.5"><div className="text-[10.5px] opacity-60">{k}</div><div className="mt-0.5 text-[15px] font-semibold tabular-nums">{v}</div></div>)}
              </div>
              <div className="mt-3"><Spark data={d.forecast.history} color="#6ee7b7" w={380} h={44} /></div>
            </div>
          </Tile>
          <Tile className="md:col-span-3" view="overview" eyebrow="Command menu" title="Everything, one keystroke away" body="⌘K jumps to any view, metric or action.">
            <div className="rounded-xl border border-line bg-paper shadow-pop">
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5 text-[13px] text-ink-faint">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
                churn<span className="ml-auto rounded border border-line-strong px-1.5 text-[10px]">⌘K</span>
              </div>
              <ul className="p-1.5 text-[13px]">
                {['Churn Warning', 'Retention Lab', 'Cohorts', 'Customer Health'].map((t, i) => (
                  <li key={t} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${i === 0 ? 'bg-navy font-medium text-accent' : 'text-ink-soft'}`}>{t}<span className="text-[11px] text-ink-faint">{i === 0 ? '↵' : 'View'}</span></li>
                ))}
              </ul>
            </div>
          </Tile>
        </Group>
      </div>

      {/* Full catalogue */}
      <div className="mt-24 rounded-3xl border border-line bg-paper p-8 shadow-card md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-accent">The full product</div>
            <h3 className="mt-1 text-[clamp(1.5rem,2.6vw,2rem)] font-semibold tracking-[-0.035em] text-ink">{NAV_ITEMS.length} views, one upload</h3>
          </div>
          <p className="max-w-sm text-[13.5px] text-ink-soft">Jump straight into any of them with the sample data loaded.</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
          {['Executive', 'Analysis', 'Platform'].map((g) => (
            <div key={g}>
              <div className="mb-3 text-[12px] font-semibold text-ink-faint">{g}</div>
              <div className="flex flex-wrap gap-2">
                {NAV_ITEMS.filter((it) => it.group === g).map((it) => (
                  <Link key={it.id} href={`/app?demo=1&view=${it.id}`}
                    className="rounded-full border border-line bg-paper-2 px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:border-accent hover:bg-navy hover:text-accent">
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Two opposing rows of live metric chips. */
export function MetricTicker({ metrics }: { metrics: [string, string][] }) {
  const row = (items: [string, string][], rev?: boolean) => (
    <div className="marquee-wrap overflow-hidden">
      <div className={`marquee flex gap-3 ${rev ? 'marquee-rev' : ''}`}>
        {[...items, ...items].map(([k, v], i) => (
          <span key={i} aria-hidden={i >= items.length || undefined}
            className="inline-flex shrink-0 items-baseline gap-2 rounded-full border border-line bg-paper px-4 py-2 shadow-card">
            <span className="text-[12.5px] text-ink-soft">{k}</span><span className="text-[14px] font-semibold tabular-nums text-ink">{v}</span>
          </span>
        ))}
      </div>
    </div>
  )
  const half = Math.ceil(metrics.length / 2)
  return (
    <section aria-label="Sample metrics" className="mt-16 space-y-3">
      {row(metrics.slice(0, half))}
      {row(metrics.slice(half), true)}
    </section>
  )
}
