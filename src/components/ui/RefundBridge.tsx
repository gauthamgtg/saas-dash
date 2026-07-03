'use client'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { CHART } from '@/src/lib/theme'
import { fmtMoney } from '@/src/lib/format'

/** Gross − Refunds = Net, as a 3-step bridge. */
export function RefundBridge({ gross, refunded, net, height = 260 }: { gross: number; refunded: number; net: number; height?: number }) {
  const rows = [
    { label: 'Gross', range: [0, gross] as [number, number], amount: gross, color: CHART.ink },
    { label: 'Refunds', range: [net, gross] as [number, number], amount: -refunded, color: CHART.neg },
    { label: 'Net', range: [0, net] as [number, number], amount: net, color: CHART.accent },
  ]
  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} interval={0} />
          <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }}
            formatter={(_v: any, _n: any, p: any) => [`${p.payload.amount >= 0 ? '' : '−'}${fmtMoney(Math.abs(p.payload.amount))}`, p.payload.label]} />
          <Bar dataKey="range" radius={[3, 3, 3, 3]} maxBarSize={72}>
            {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
            <LabelList dataKey="amount" position="top" className="fill-ink-soft"
              formatter={(v: any) => `${Number(v) >= 0 ? '' : '−'}${fmtMoney(Math.abs(Number(v)))}`} style={{ fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
