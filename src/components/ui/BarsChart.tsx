'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell } from 'recharts'

type Series = { key: string; color: string; name?: string }

/** Rescale each row so its series values sum to 100 — same shape, percent-of-total per column.
 *  Negative inputs (e.g. a refund-heavy bucket net-negative for the month) floor to 0: a share
 *  of the whole can't be negative, and letting one through would push every other bar past 100%. */
function toPercent(data: Record<string, any>[], series: Series[]): Record<string, any>[] {
  return data.map((row) => {
    const positive = series.map((ser) => Math.max(0, Number(row[ser.key]) || 0))
    const total = positive.reduce((s, v) => s + v, 0)
    const out: Record<string, any> = { ...row }
    series.forEach((s, i) => { out[s.key] = total ? (positive[i] / total) * 100 : 0 })
    return out
  })
}

export function BarsChart({ data, xKey, series, stacked, percent, height = 288, colorByPoint, horizontal }: {
  data: Record<string, any>[]; xKey: string; series: Series[]; stacked?: boolean; height?: number
  colorByPoint?: (row: Record<string, any>) => string  // per-bar color (single-series only)
  horizontal?: boolean
  /** Show each stacked column as a share of its own total (0–100) instead of absolute values. */
  percent?: boolean
}) {
  const chartData = percent ? toPercent(data, series) : data
  return (
    <div className="w-full tabular-nums" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={!!horizontal} horizontal={!horizontal} stroke="var(--line)" />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} width={110} tick={{ fontSize: 11 }} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={12} />
              <YAxis tickLine={false} axisLine={false} width={48} domain={percent ? [0, 100] : undefined} allowDataOverflow={percent}
                tickFormatter={(v: number) => percent ? `${Math.round(v)}%` : Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v)} />
            </>
          )}
          <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }} formatter={percent ? (v: any) => `${Number(v).toFixed(1)}%` : undefined} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-display)' }} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color}
              stackId={stacked ? 'a' : undefined} radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} maxBarSize={64}>
              {colorByPoint && series.length === 1 && chartData.map((row, i) => <Cell key={i} fill={colorByPoint(row)} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
