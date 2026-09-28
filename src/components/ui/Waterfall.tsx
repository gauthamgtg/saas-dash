'use client'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, ReferenceLine } from 'recharts'
import { CHART } from '@/src/lib/theme'
import { fmtMoney } from '@/src/lib/format'

/** MRR movement bridge, zoomed to the delta band so each component reads clearly.
 *  Opening/Closing shown as reference lines; the five components float between them. */
export function Waterfall({ opening, newMrr, expansion, reactivation, contraction, churn, height = 300 }: {
  opening: number; newMrr: number; expansion: number; reactivation: number; contraction: number; churn: number; height?: number
}) {
  let run = opening
  const rows: { label: string; full: string; range: [number, number]; amount: number; color: string }[] = []
  // short tick labels — the full names collide in narrow panels; tooltip carries the full name
  const add = (label: string, full: string, v: number, color: string) => {
    if (v >= 0) { rows.push({ label, full, range: [run, run + v], amount: v, color }); run += v }
    else { rows.push({ label, full, range: [run + v, run], amount: v, color }); run += v }
  }
  add('New', 'New', newMrr, CHART.pos)
  add('Expand', 'Expansion', expansion, CHART.steel)
  add('React', 'Reactivation', reactivation, CHART.violet)
  add('Contract', 'Contraction', -Math.abs(contraction), CHART.warn)
  add('Churn', 'Churn', -Math.abs(churn), CHART.neg)
  const closing = run

  const lo = Math.min(opening, closing, ...rows.map((r) => r.range[0]))
  const hi = Math.max(opening, closing, ...rows.map((r) => r.range[1]))
  const pad = Math.max(1, (hi - lo) * 0.35)

  return (
    <div className="w-full tabular-nums">
      {/* open/close in a legend row — inline reference-line labels collided with the bars */}
      <div className="mb-2 flex items-center gap-4 text-[11.5px] text-ink-faint">
        <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed border-ink-faint" />Open <b className="font-medium text-ink">{fmtMoney(opening)}</b></span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t border-dashed" style={{ borderColor: CHART.accent }} />Close <b className="font-medium text-ink">{fmtMoney(closing)}</b></span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="2 5" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tickMargin={8} interval={0} tick={{ fontSize: 10 }} />
          <YAxis domain={[Math.max(0, lo - pad), hi + pad]} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
          <Tooltip cursor={{ fill: 'rgba(127,127,127,0.06)' }}
            formatter={(_v: any, _n: any, p: any) => [`${p.payload.amount >= 0 ? '+' : ''}${fmtMoney(p.payload.amount)}`, p.payload.full]} />
          <ReferenceLine y={opening} stroke="var(--ink-faint)" strokeDasharray="4 4" />
          <ReferenceLine y={closing} stroke={CHART.accent} strokeDasharray="4 4" />
          <Bar dataKey="range" radius={[3, 3, 3, 3]} maxBarSize={64}>
            {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
            <LabelList dataKey="amount" position="top" className="fill-ink-soft"
              formatter={(v: any) => `${Number(v) >= 0 ? '+' : ''}${Math.round(Number(v) / 1000)}k`} style={{ fontSize: 10 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
