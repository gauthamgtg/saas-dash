'use client'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from 'recharts'

type Series = { key: string; color: string; name?: string; ghost?: boolean }
type RefLine = { y: number; label: string; color?: string }

export function TrendChart({ data, xKey, series, area, height = 288, refLines, showLegend }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; area?: boolean; height?: number
  refLines?: RefLine[]; showLegend?: boolean
}) {
  const legend = showLegend ?? series.filter((s) => !s.ghost).length > 1
  const common = (
    <>
      <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
      <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={16} />
      <YAxis tickLine={false} axisLine={false} width={48} />
      <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
      {legend && <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />}
      {refLines?.map((r) => (
        <ReferenceLine key={r.label} y={r.y} stroke={r.color ?? 'var(--ink-faint)'} strokeDasharray="4 4"
          label={{ value: r.label, position: 'insideTopRight', fontSize: 10, fill: r.color ?? 'var(--ink-faint)' }} />
      ))}
    </>
  )
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.filter((s) => !s.ghost).map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s) => s.ghost
              ? <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.5} fill="none" dot={false} />
              : <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 3 }} />,
            )}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
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
