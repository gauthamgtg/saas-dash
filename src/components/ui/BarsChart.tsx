'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts'

type Series = { key: string; color: string; name?: string }

export function BarsChart({ data, xKey, series, stacked, height = 288, colorByPoint, horizontal }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; stacked?: boolean; height?: number
  colorByPoint?: (row: Record<string, any>) => string  // per-bar color (single-series only)
  horizontal?: boolean
}) {
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={!!horizontal} horizontal={!horizontal} stroke="var(--line)" />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} width={110} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} width={48} />
            </>
          )}
          <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-mono)' }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color}
              stackId={stacked ? 'a' : undefined} radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={64}>
              {colorByPoint && series.length === 1 && data.map((row, i) => <Cell key={i} fill={colorByPoint(row)} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
