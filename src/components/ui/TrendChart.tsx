'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function TrendChart({ data, xKey, series }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]
}) {
  return (
    <div className="h-72 w-full border border-line bg-paper p-3 font-mono">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} /><YAxis tickLine={false} axisLine={false} width={44} /><Tooltip cursor={{ stroke: 'var(--line-strong)' }} /><Legend iconType="plainline" />
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} dot={false} strokeWidth={2} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
