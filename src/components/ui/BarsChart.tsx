'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

export function BarsChart({ data, xKey, series, stacked }: {
  data: Record<string, any>[]; xKey: string; series: { key: string; color: string; name?: string }[]; stacked?: boolean
}) {
  return (
    <div className="h-72 w-full rounded-lg border border-slate-200 bg-white p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey={xKey} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name ?? s.key} fill={s.color} stackId={stacked ? 'a' : undefined} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
