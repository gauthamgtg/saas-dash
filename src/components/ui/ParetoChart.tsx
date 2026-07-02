'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts'
import { CHART } from '@/src/lib/theme'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Cumulative concentration (Lorenz) curve: x = cumulative customer share, y = cumulative revenue share.
 *  The dashed diagonal is perfect equality; the bow above it is concentration. */
export function ParetoChart({ points, height = 260 }: { points: { x: number; y: number }[]; height?: number }) {
  const data = points.map((p) => ({ x: p.x, y: p.y, eq: p.x }))
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" stroke="var(--line)" />
          <XAxis dataKey="x" type="number" domain={[0, 1]} tickFormatter={pct} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} />
          <YAxis type="number" domain={[0, 1]} tickFormatter={pct} tickLine={false} axisLine={false} width={44} />
          <Tooltip formatter={(v: any) => pct(v)} labelFormatter={(l: any) => `Top ${pct(l)} of customers`} />
          <ReferenceLine y={0.8} stroke="var(--warn)" strokeDasharray="4 4" label={{ value: '80% rev', position: 'insideTopRight', fontSize: 10, fill: 'var(--warn)' }} />
          <Line type="monotone" dataKey="eq" stroke="var(--line-strong)" strokeDasharray="5 5" strokeWidth={1.5} dot={false} name="Equality" isAnimationActive={false} />
          <Line type="monotone" dataKey="y" stroke={CHART.accent} strokeWidth={2.5} dot={false} name="Cumulative revenue" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
