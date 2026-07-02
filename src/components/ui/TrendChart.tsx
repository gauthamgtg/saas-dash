'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function TrendChart({ data, xKey, series }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]
}) {
  return (
    <div className="h-72 w-full rounded-lg border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey={xKey} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name ?? s.key} stroke={s.color} dot={false} strokeWidth={2} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
