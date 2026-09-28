'use client'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts'

type Series = { key: string; color: string; name?: string; ghost?: boolean }

/** SVG ids can't contain spaces — "Net new" would silently break url(#…) fills. */
const gid = (key: string) => `g-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
type RefLine = { y: number; label: string; color?: string }
type Marker = { month: string; label: string }

export function TrendChart({ data, xKey, series, area, height = 288, refLines, markers, showLegend, onPointClick }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; area?: boolean; height?: number
  refLines?: RefLine[]; markers?: Marker[]; showLegend?: boolean
  /** Click a data point / column → drill into that x value (e.g. month). */
  onPointClick?: (x: string) => void
}) {
  // Map click x → nearest data index ourselves (Recharts' activeLabel is unreliable across versions).
  // 48 = YAxis width, 8 = right margin — keep in sync with the axis/margin props below.
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!onPointClick || data.length < 2) return
    const rect = e.currentTarget.getBoundingClientRect()
    const plotX = e.clientX - rect.left - 48
    const plotW = rect.width - 48 - 8
    if (plotW <= 0) return
    const idx = Math.max(0, Math.min(data.length - 1, Math.round((plotX / plotW) * (data.length - 1))))
    const v = data[idx]?.[xKey]
    if (v != null) onPointClick(String(v))
  }
  const legend = showLegend ?? series.filter((s) => !s.ghost).length > 1
  const common = (
    <>
      <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
      <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={16} />
      <YAxis tickLine={false} axisLine={false} width={48}
        tickFormatter={(v: number) => Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v)} />
      <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
      {legend && <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-display)' }} />}
      {refLines?.map((r) => (
        <ReferenceLine key={r.label} y={r.y} stroke={r.color ?? 'var(--ink-faint)'} strokeDasharray="4 4"
          label={{ value: r.label, position: 'insideTopRight', fontSize: 10, fill: r.color ?? 'var(--ink-faint)' }} />
      ))}
      {markers?.map((mk, i) => (
        <ReferenceLine key={`mk${i}`} x={mk.month} stroke="var(--ink-faint)" strokeDasharray="2 3"
          label={{ value: mk.label, position: 'top', offset: 6 + (i % 3) * 14, fontSize: 9, fill: 'var(--ink-soft)' }} />
      ))}
    </>
  )
  return (
    <div onClick={onPointClick ? handleClick : undefined}
      className={`w-full ${onPointClick ? 'cursor-pointer [&_.recharts-wrapper]:!cursor-pointer' : ''} tabular-nums`} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: markers?.length ? 42 : 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.filter((s) => !s.ghost).map((s) => (
                <linearGradient key={s.key} id={gid(s.key)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s) => s.ghost
              ? <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} fill="none" dot={false} />
              : <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={2} fill={`url(#${gid(s.key)})`} dot={false} activeDot={{ r: 3 }} />,
            )}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: markers?.length ? 42 : 6, right: 8, bottom: 0, left: 0 }}>
            {common}
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color}
                dot={false} strokeWidth={s.ghost ? 1.5 : 2} strokeDasharray={s.ghost ? '4 4' : undefined}
                strokeOpacity={s.ghost ? 0.5 : 1} activeDot={s.ghost ? false : { r: 3 }} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
