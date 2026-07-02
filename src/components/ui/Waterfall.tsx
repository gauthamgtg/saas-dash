'use client'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { CHART } from '@/src/lib/theme'
import { fmtMoney } from '@/src/lib/format'

/** MRR movement bridge: Opening + New + Expansion + Reactivation − Contraction − Churn = Closing. */
export function Waterfall({ opening, newMrr, expansion, reactivation, contraction, churn, height = 300 }: {
  opening: number; newMrr: number; expansion: number; reactivation: number; contraction: number; churn: number; height?: number
}) {
  let run = opening
  const rows: { label: string; range: [number, number]; amount: number; color: string }[] = []
  rows.push({ label: 'Opening', range: [0, opening], amount: opening, color: CHART.ink })
  const add = (label: string, v: number, color: string) => {
    if (v >= 0) { rows.push({ label, range: [run, run + v], amount: v, color }); run += v }
    else { rows.push({ label, range: [run + v, run], amount: v, color }); run += v }
  }
  add('New', newMrr, CHART.pos)
  add('Expansion', expansion, CHART.steel)
  add('Reactivation', reactivation, CHART.violet)
  add('Contraction', -Math.abs(contraction), CHART.warn)
  add('Churn', -Math.abs(churn), CHART.neg)
  rows.push({ label: 'Closing', range: [0, run], amount: run, color: CHART.accent })

  return (
    <div className="w-full font-mono" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} interval={0} tick={{ fontSize: 10 }} />
          <YAxis tickLine={false} axisLine={false} width={52} />
          <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }}
            formatter={(v: any, _n: any, p: any) => [`${p.payload.amount >= 0 ? '+' : ''}${fmtMoney(p.payload.amount)}`, p.payload.label]} />
          <Bar dataKey="range" radius={[3, 3, 3, 3]} maxBarSize={70}>
            {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
            <LabelList dataKey="amount" position="top" className="fill-ink-soft"
              formatter={(v: any) => `${Number(v) >= 0 ? '+' : ''}${Math.round(Number(v) / 1000)}k`} style={{ fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
