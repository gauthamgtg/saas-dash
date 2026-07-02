'use client'
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

type Series = { key: string; color: string; name?: string; axis?: 'left' | 'right'; type?: 'line' | 'bar' }

/** Two-axis combo chart (e.g. churn% on the right, retention% on the left; or bars + line). */
export function DualAxisChart({ data, xKey, series, height = 260, leftFmt, rightFmt }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; height?: number
  leftFmt?: (v: number) => string; rightFmt?: (v: number) => string
}) {
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={16} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} width={46} tickFormatter={leftFmt} />
          <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} width={46} tickFormatter={rightFmt} />
          <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />
          {series.map((s) =>
            s.type === 'bar' ? (
              <Bar key={s.key} yAxisId={s.axis ?? 'left'} dataKey={s.key} name={s.name ?? s.key} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={28} />
            ) : (
              <Line key={s.key} yAxisId={s.axis ?? 'left'} type="monotone" dataKey={s.key} name={s.name ?? s.key}
                stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
            ),
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
