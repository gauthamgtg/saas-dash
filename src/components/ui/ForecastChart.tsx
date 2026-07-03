'use client'
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { CHART } from '@/src/lib/theme'
import type { ForecastPoint } from '@/src/lib/engine/forecast'

/** Observed MRR (solid area) continued by a dashed projection inside a shaded uncertainty cone. */
export function ForecastChart({ observed, forecast, height = 280 }: {
  observed: { month: string; MRR: number }[]; forecast: ForecastPoint[]; height?: number
}) {
  const lastObs = observed[observed.length - 1]
  // stacked-area band trick: base=lo (invisible), band=hi-lo (faint fill)
  const data = [
    ...observed.map((o) => ({ month: o.month, MRR: o.MRR })),
    ...forecast.map((f) => ({ month: f.month, projected: f.projected, base: f.lo, band: f.hi - f.lo })),
  ]
  // stitch the projection to the last observed point so the dashed line connects
  if (lastObs && forecast.length) {
    const first = data.find((d) => d.month === forecast[0].month)!
    data[observed.length - 1] = { ...data[observed.length - 1], projected: lastObs.MRR, base: lastObs.MRR, band: 0 } as any
    void first
  }
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="fc-mrr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} minTickGap={16} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <Tooltip cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
          {lastObs && <ReferenceLine x={lastObs.month} stroke="var(--ink-faint)" strokeDasharray="3 3" label={{ value: 'now', position: 'insideTopRight', fontSize: 10, fill: 'var(--ink-faint)' }} />}
          <Area dataKey="base" stackId="cone" stroke="none" fill="none" isAnimationActive={false} />
          <Area dataKey="band" stackId="cone" stroke="none" fill={CHART.accent} fillOpacity={0.1} isAnimationActive={false} />
          <Area dataKey="MRR" stroke={CHART.accent} strokeWidth={2} fill="url(#fc-mrr)" dot={false} />
          <Line dataKey="projected" stroke={CHART.accent} strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
