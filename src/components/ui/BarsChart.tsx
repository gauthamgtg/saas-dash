'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function BarsChart({ data, xKey, series, stacked }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]; stacked?: boolean
}) {
  return (
    <div className="h-72 w-full border border-line bg-paper p-3 font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} /><YAxis tickLine={false} axisLine={false} width={44} /><Tooltip cursor={{ fill: 'rgba(16,38,59,0.06)' }} /><Legend />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color} stackId={stacked ? 'a' : undefined} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
