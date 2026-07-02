'use client'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

type Series = { key: string; color: string; name?: string }

export function TrendChart({ data, xKey, series, area, height = 288 }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; area?: boolean; height?: number
}) {
  const grid = <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
  const axes = (
    <>
      <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={16} />
      <YAxis tickLine={false} axisLine={false} width={48} />
      <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
      {series.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />}
    </>
  )
  return (
    <div className="w-full rounded-xl border border-line bg-paper p-4 font-mono shadow-card" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {area ? (
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {grid}{axes}
            {series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} dot={false} activeDot={{ r: 3 }} />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            {grid}{axes}
            {series.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                stroke={s.color} dot={false} strokeWidth={2} activeDot={{ r: 3 }} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
