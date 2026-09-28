'use client'
import { useMemo, useState } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell, LabelList } from 'recharts'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { marketStats, currencyExposure, tileLayout, geoOf, type GeoDim, type MarketRow } from '@/src/lib/geo'
import { monthDiff } from '@/src/lib/types'
import { flag } from '@/src/lib/flags'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { Sparkline } from '@/src/components/ui/Sparkline'
import { Callout } from '@/src/components/ui/Callout'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtNum, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0'
const TRACK = 'inline-flex h-8 items-center rounded-lg border border-line bg-paper-2 p-0.5'
const SEG = 'h-full rounded-[6px] px-2.5 text-[12px] font-medium transition-all'
const segCls = (on: boolean) => `${SEG} ${on ? 'bg-paper text-ink shadow-card' : 'text-ink-soft hover:text-ink'}`
const COLS = 30, ROWS = 14, TILE = 26, GAP = 3
type Metric = 'share' | 'growth' | 'nrr'
type SortKey = 'mrr' | 'growth' | 'nrr' | 'churn' | 'arpa' | 'customers' | 'newLogos'

/** Diverging fill around a neutral point; share uses a single accent ramp. */
function tileFill(metric: Metric, r: MarketRow | undefined, maxShare: number) {
  if (!r) return 'var(--paper-2)'
  if (metric === 'share') return `color-mix(in srgb, var(--accent) ${20 + (r.share / (maxShare || 1)) * 80}%, var(--paper))`
  const v = metric === 'growth' ? r.growth : r.nrr != null ? r.nrr - 1 : null
  if (v == null) return 'color-mix(in srgb, var(--ink-faint) 30%, var(--paper))'
  const scale = metric === 'growth' ? 0.08 : 0.25 // ±8%/mo growth, ±25pp NRR saturates
  const k = Math.min(1, Math.abs(v) / scale)
  return `color-mix(in srgb, var(${v >= 0 ? '--pos' : '--neg'}) ${25 + k * 70}%, var(--paper))`
}

const QUAD = (growth: number, nrr: number, gMid: number) =>
  growth >= gMid ? (nrr >= 1 ? 'Invest' : 'Fix retention') : (nrr >= 1 ? 'Harvest' : 'Watch')
const QUAD_COLOR: Record<string, string> = { Invest: '#15a34a', 'Fix retention': '#d97706', Harvest: '#2563eb', Watch: '#dc4a34' }

export function Geo() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const hasCountry = useMemo(() => txs.some((t) => t.country), [txs])
  const hasRegion = useMemo(() => txs.some((t) => t.region), [txs])
  const [dimPick, setDim] = useState<GeoDim>('country')
  const dim: GeoDim = dimPick === 'country' && !hasCountry ? 'region' : dimPick === 'region' && !hasRegion ? 'country' : dimPick
  const [metric, setMetric] = useState<Metric>('share')
  const [sort, setSort] = useState<SortKey>('mrr')
  const [hover, setHover] = useState<string | null>(null)

  const d = useMemo(() => {
    const { months, rows } = marketStats(txs, dim, state.controls.mode)
    const countries = dim === 'country' ? rows : hasCountry ? marketStats(txs, 'country', state.controls.mode).rows : []
    const last = months[months.length - 1] ?? ''
    // stacked MRR by region/country over time: top 5 + Other
    const top = rows.slice(0, 5).map((r) => r.key)
    const stack = months.slice(-12).map((mo) => {
      const i = months.indexOf(mo)
      const row: Record<string, number | string> = { month: mo }
      let other = 0
      for (const r of rows) { const v = Math.round(r.spark[i]); if (top.includes(r.key)) row[r.key] = v; else other += v }
      if (rows.length > 5) row.Other = other
      return row
    })
    const byCountry = new Map(countries.map((r) => [geoOf(r.key)?.name ?? r.key.toLowerCase(), r]))
    const unmapped = countries.filter((r) => !geoOf(r.key))
    const withGrowth = rows.filter((r) => r.growth != null && r.mrr > 0)
    const gMid = withGrowth.length ? [...withGrowth].sort((a, b) => a.growth! - b.growth!)[Math.floor(withGrowth.length / 2)].growth! : 0
    const fastest = [...withGrowth].sort((a, b) => b.growth! - a.growth!)[0]
    return {
      months, rows, last, top, stack, byCountry, unmapped, gMid, fastest,
      fx: last ? currencyExposure(txs, last) : null,
      live: rows.filter((r) => r.mrr > 0),
      maxShare: Math.max(0, ...countries.map((r) => r.share)),
    }
  }, [txs, dim, state.controls.mode, hasCountry])

  const tiles = useMemo(() => tileLayout(COLS, ROWS), [])

  if (!d.rows.length || (!hasCountry && !hasRegion)) {
    return (
      <div className="space-y-6">
        <ViewHeader kicker="Geography" title="Markets" sub="Map a country or region column on upload to unlock geographic analysis." />
      </div>
    )
  }

  const sorted = [...d.rows].sort((a, b) => ((b[sort] ?? -Infinity) as number) - ((a[sort] ?? -Infinity) as number))
  const hovered = hover ? d.byCountry.get(hover) : undefined
  const topRow = d.live[0]
  const sensitivity = d.fx ? d.fx.foreign * 0.1 : 0

  const TH = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="py-2 pl-3 text-right font-medium">
      <button onClick={() => setSort(k)} className={`inline-flex items-center gap-0.5 ${sort === k ? 'text-ink' : 'hover:text-ink-soft'}`}>
        {label}{sort === k && <span aria-hidden>↓</span>}
      </button>
    </th>
  )

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Geography" title="Markets" sub="Where revenue comes from, which markets are growing, and which are leaking."
        actions={(hasCountry && hasRegion) ? (
          <div className={TRACK}>
            {(['country', 'region'] as const).map((k) => <button key={k} onClick={() => setDim(k)} className={segCls(dim === k)}>{k === 'country' ? 'Countries' : 'Regions'}</button>)}
          </div>
        ) : undefined} />

      <div className={KSTRIP}>
        <KpiCard label={dim === 'country' ? 'Active countries' : 'Active regions'} value={fmtNum(d.live.length)} hint={`of ${d.rows.length} with any revenue`} />
        <KpiCard label="Largest market" value={topRow ? fmtPct(topRow.share, 0) : '—'} hint={topRow ? `${flag(topRow.key)} ${topRow.key} · ${fmtMoneyShort(topRow.mrr)} MRR` : undefined} />
        <KpiCard label="Fastest growing" value={d.fastest ? `${fmtPct(d.fastest.growth)}/mo` : '—'} tone={d.fastest && d.fastest.growth! > 0 ? 'pos' : 'default'} hint={d.fastest ? `${d.fastest.key} · trailing 6 mo` : undefined} />
        <KpiCard label="FX-exposed MRR" value={d.fx ? fmtPct(d.fx.foreignShare, 0) : '—'} hint={d.fx?.base ? `billed outside ${d.fx.base}` : 'single currency'} />
      </div>

      {hasCountry && (
        <Panel title="World map" sub={metric === 'share' ? 'Share of current MRR' : metric === 'growth' ? 'Monthly MRR growth, trailing 6 months' : 'Net revenue retention, trailing 12 months'}
          right={<div className={TRACK}>{(['share', 'growth', 'nrr'] as const).map((k) => <button key={k} onClick={() => setMetric(k)} className={segCls(metric === k)}>{k === 'share' ? 'MRR share' : k === 'growth' ? 'Growth' : 'NRR'}</button>)}</div>}>
          <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
            <div className="overflow-x-auto">
              <svg width={COLS * (TILE + GAP)} height={ROWS * (TILE + GAP)} role="img" aria-label="World tile map of revenue by country" onMouseLeave={() => setHover(null)} className="mx-auto block">
                {tiles.map((t) => {
                  const r = d.byCountry.get(t.name)
                  return (
                    <g key={t.name} transform={`translate(${t.col * (TILE + GAP)},${t.row * (TILE + GAP)})`} onMouseEnter={() => r && setHover(t.name)} className={r ? 'cursor-pointer' : ''}>
                      <rect width={TILE} height={TILE} rx={6} fill={tileFill(metric, r, d.maxShare)}
                        stroke={hover === t.name ? 'var(--ink)' : r ? 'color-mix(in srgb, var(--ink) 12%, transparent)' : 'none'} strokeWidth={hover === t.name ? 1.5 : 1} />
                      {r && <text x={TILE / 2} y={TILE / 2 + 5} textAnchor="middle" fontSize="14">{flag(r.key)}</text>}
                      <title>{r ? `${r.key}: ${fmtMoney(r.mrr)} MRR · ${fmtPct(r.share)}` : t.name}</title>
                    </g>
                  )
                })}
              </svg>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-faint">
                {metric === 'share' ? <>Less {[20, 45, 70, 100].map((p) => <span key={p} className="h-3 w-5 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--accent) ${p}%, var(--paper))` }} />)} More</>
                  : <><span className="h-3 w-5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--neg) 80%, var(--paper))' }} />{metric === 'growth' ? 'Shrinking' : '< 100%'}
                    <span className="h-3 w-5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--ink-faint) 30%, var(--paper))' }} />n/a
                    <span className="h-3 w-5 rounded-[3px]" style={{ background: 'color-mix(in srgb, var(--pos) 80%, var(--paper))' }} />{metric === 'growth' ? 'Growing' : '> 100%'}</>}
                {d.unmapped.length > 0 && <span className="ml-auto">Not on map: {d.unmapped.map((u) => u.key).join(', ')}</span>}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-paper-2 p-4">
              {hovered ? (
                <>
                  <div className="flex items-center gap-2"><span className="text-[22px] leading-none">{flag(hovered.key)}</span><span className="text-[15px] font-semibold text-ink">{hovered.key}</span></div>
                  <dl className="mt-3 space-y-1.5 text-[13px]">
                    {[['MRR', fmtMoney(hovered.mrr)], ['Share', fmtPct(hovered.share)], ['Growth', hovered.growth != null ? `${fmtPct(hovered.growth)}/mo` : '—'],
                      ['NRR', fmtPct(hovered.nrr)], ['Customers', fmtNum(hovered.customers)], ['ARPA', fmtMoney(hovered.arpa)], ['In market since', hovered.firstMonth]].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2"><dt className="text-ink-soft">{k}</dt><dd className="font-medium tabular-nums text-ink">{v}</dd></div>
                    ))}
                  </dl>
                  <div className="mt-3"><Sparkline data={hovered.spark.slice(-12)} w={200} h={36} /></div>
                </>
              ) : <p className="text-[13px] leading-relaxed text-ink-faint">Hover a country for its numbers. Tiles are placed by rough position — a stylised map, not to scale.</p>}
            </div>
          </div>
        </Panel>
      )}

      <Panel title="Market scorecard" sub="Click a column to sort · growth is compound monthly over the last 6 months"
        bodyClass="overflow-x-auto"
        csv={{ filename: `markets-${dim}`, rows: sorted.map((r) => ({ market: r.key, mrr: Math.round(r.mrr), share: r.share, growth_mo: r.growth, nrr: r.nrr, grr: r.grr, churn_mo: r.churn, arpa: r.arpa, customers: r.customers, new_3mo: r.newLogos, refund_rate: r.refundRate, first_month: r.firstMonth })) }}>
        <table className="w-full min-w-[860px] text-[13.5px] tabular-nums">
          <thead><tr className="text-left text-[12px] text-ink-faint">
            <th className="py-2 font-medium">Market</th><TH k="mrr" label="MRR" /><th className="py-2 pl-3 text-right font-medium">Share</th>
            <TH k="growth" label="Growth/mo" /><TH k="nrr" label="NRR" /><th className="py-2 pl-3 text-right font-medium">GRR</th>
            <TH k="churn" label="Churn/mo" /><TH k="arpa" label="ARPA" /><TH k="customers" label="Customers" /><TH k="newLogos" label="New · 3 mo" />
            <th className="py-2 pl-3 text-right font-medium">Refunds</th><th className="py-2 pl-3 text-right font-medium">Trend</th>
          </tr></thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="py-2.5"><span className="flex items-center gap-2"><span className="text-[16px] leading-none">{dim === 'country' ? flag(r.key) : '🌐'}</span><span className="font-medium text-ink">{r.key}</span></span></td>
                <td className="py-2.5 pl-3 text-right font-semibold text-ink">{fmtMoney(r.mrr)}</td>
                <td className="py-2.5 pl-3 text-right text-ink-soft">{fmtPct(r.share)}</td>
                <td className={`py-2.5 pl-3 text-right font-medium ${r.growth == null ? 'text-ink-faint' : r.growth >= 0 ? 'text-pos' : 'text-neg'}`}>{r.growth == null ? '—' : `${r.growth >= 0 ? '+' : ''}${fmtPct(r.growth)}`}</td>
                <td className={`py-2.5 pl-3 text-right ${r.nrr == null ? 'text-ink-faint' : r.nrr >= 1 ? 'text-pos' : 'text-neg'}`}>{fmtPct(r.nrr)}</td>
                <td className="py-2.5 pl-3 text-right text-ink-soft">{fmtPct(r.grr)}</td>
                <td className="py-2.5 pl-3 text-right text-ink-soft">{fmtPct(r.churn)}</td>
                <td className="py-2.5 pl-3 text-right text-ink-soft">{fmtMoney(r.arpa)}</td>
                <td className="py-2.5 pl-3 text-right text-ink">{fmtNum(r.customers)}</td>
                <td className="py-2.5 pl-3 text-right text-ink">{r.newLogos ? `+${r.newLogos}` : '0'}</td>
                <td className="py-2.5 pl-3 text-right text-ink-soft">{fmtPct(r.refundRate)}</td>
                <td className="py-2.5 pl-3"><div className="flex justify-end"><Sparkline data={r.spark.slice(-12)} w={72} h={22} color={r.growth != null && r.growth < 0 ? 'var(--neg)' : 'var(--accent)'} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Growth vs retention" sub="Bubble size = MRR · lines at median growth and 100% NRR">
          <div className="relative h-[300px] tabular-nums">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 16, bottom: 4, left: -4 }}>
                <CartesianGrid strokeDasharray="2 5" stroke="var(--line)" />
                <XAxis type="number" dataKey="g" name="Growth" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                <YAxis type="number" dataKey="n" name="NRR" tickLine={false} axisLine={false} width={44} domain={['auto', 'auto']} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                <ZAxis type="number" dataKey="mrr" range={[60, 900]} />
                <ReferenceLine x={d.gMid} stroke="var(--line-strong)" strokeDasharray="4 4" />
                <ReferenceLine y={1} stroke="var(--line-strong)" strokeDasharray="4 4" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                  const p = payload?.[0]?.payload as { key: string; g: number; n: number; mrr: number; q: string } | undefined
                  return p ? <div className="recharts-default-tooltip"><div className="font-semibold">{p.key} · {p.q}</div><div>{fmtMoney(p.mrr)} MRR · {fmtPct(p.g)}/mo · NRR {fmtPct(p.n)}</div></div> : null
                }} />
                <Scatter data={d.live.filter((r) => r.growth != null && r.nrr != null).map((r) => ({ key: r.key, g: r.growth!, n: r.nrr!, mrr: Math.round(r.mrr), q: QUAD(r.growth!, r.nrr!, d.gMid) }))}>
                  {d.live.filter((r) => r.growth != null && r.nrr != null).map((r) => <Cell key={r.key} fill={QUAD_COLOR[QUAD(r.growth!, r.nrr!, d.gMid)]} fillOpacity={0.55} stroke={QUAD_COLOR[QUAD(r.growth!, r.nrr!, d.gMid)]} />)}
                  <LabelList dataKey="key" position="top" fontSize={11} fill="var(--ink-soft)" />
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] md:grid-cols-4">
            {Object.entries({ Invest: 'Growing and retaining', 'Fix retention': 'Growing but leaking', Harvest: 'Sticky, slow growth', Watch: 'Slow and leaking' }).map(([q, t]) => (
              <div key={q} className="flex items-start gap-1.5"><span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: QUAD_COLOR[q] }} /><span><b className="font-semibold text-ink">{q}</b> <span className="text-ink-faint">{t}</span></span></div>
            ))}
          </div>
        </Panel>

        <Panel title={`MRR by ${dim}`} sub="Last 12 months · top 5 plus other">
          <BarsChart data={d.stack} xKey="month" stacked height={300}
            series={[...d.top, ...(d.rows.length > 5 ? ['Other'] : [])].map((k, i) => ({ key: k, color: k === 'Other' ? '#a3a9a4' : CHART.series[i % CHART.series.length] }))} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Market entry timeline" sub="First revenue in each market, through today">
          <ul className="space-y-2">
            {[...d.rows].sort((a, b) => a.firstMonth.localeCompare(b.firstMonth)).slice(0, 14).map((r) => {
              const total = Math.max(1, d.months.length - 1)
              const start = monthDiff(d.months[0], r.firstMonth) / total
              return (
                <li key={r.key} className="grid grid-cols-[130px_1fr_70px] items-center gap-3 text-[13px]">
                  <span className="flex min-w-0 items-center gap-1.5"><span>{dim === 'country' ? flag(r.key) : '🌐'}</span><span className="truncate text-ink">{r.key}</span></span>
                  <span className="relative h-5 rounded-md bg-paper-2">
                    <span className="absolute inset-y-1 rounded" title={`since ${r.firstMonth}`}
                      style={{ left: `${start * 100}%`, right: 0, background: r.mrr > 0 ? 'color-mix(in srgb, var(--accent) 70%, var(--paper))' : 'var(--line-strong)' }} />
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-ink-faint">{r.firstMonth}</span>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex justify-between pl-[142px] pr-[82px] text-[11px] tabular-nums text-ink-faint"><span>{d.months[0]}</span><span>{d.last}</span></div>
        </Panel>

        <Panel title="Currency exposure" sub={`Latest month · base ${d.fx?.base ?? '—'}`}>
          {d.fx && (
            <>
              <ul className="space-y-2.5">
                {d.fx.rows.map((r, i) => (
                  <li key={r.ccy} className="grid grid-cols-[48px_1fr_80px] items-center gap-3 text-[13px]">
                    <span className="font-semibold text-ink">{r.ccy}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-paper-2"><span className="block h-full rounded-full" style={{ width: `${r.share * 100}%`, background: r.foreign ? CHART.series[(i + 1) % CHART.series.length] : 'var(--accent)' }} /></span>
                    <span className="text-right tabular-nums text-ink-soft">{fmtPct(r.share, 0)} · {fmtMoneyShort(r.revenue)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-line bg-paper-2 p-4">
                <div className="text-[12.5px] font-medium text-ink-soft">FX sensitivity</div>
                <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em] tabular-nums text-ink">±{fmtMoney(sensitivity)} <span className="text-[13px] font-normal text-ink-faint">MRR</span></div>
                <p className="mt-1 text-[12.5px] text-ink-soft">if every non-{d.fx.base ?? 'base'} currency moved 10% against {d.fx.base ?? 'base'}.</p>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Callout>Market metrics are only as good as the country / region column in your export. Growth and NRR need several months of history per market, so small or new markets show “—”.</Callout>
    </div>
  )
}
