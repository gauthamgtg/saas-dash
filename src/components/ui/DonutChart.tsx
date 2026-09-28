'use client'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct } from '@/src/lib/format'

/** Donut with a center total + a right-hand legend of value/share (MRR-by-plan style). */
export function DonutChart({ data, centerLabel, unit = 'money', height = 200 }: {
  data: { key: string; value: number }[]
  centerLabel?: string
  unit?: 'money' | 'num'
  height?: number
}) {
  const rows = data.filter((d) => d.value > 0)
  const total = rows.reduce((s, d) => s + d.value, 0)
  const fmt = (v: number) => (unit === 'money' ? fmtMoney(v) : v.toLocaleString('en-US'))
  const dSize = Math.min(height, 130)
  return (
    <div className="flex flex-wrap items-center gap-4" style={{ minHeight: height }}>
      <div className="relative shrink-0" style={{ width: dSize, height: dSize }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="key" innerRadius="66%" outerRadius="100%"
              paddingAngle={rows.length > 1 ? 2 : 0} stroke="none" isAnimationActive={false}>
              {rows.map((_, i) => <Cell key={i} fill={CHART.series[i % CHART.series.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-lg font-semibold tabular-nums text-ink">{fmt(total)}</div>
          {centerLabel && <div className="text-[11px] text-ink-faint font-medium">{centerLabel}</div>}
        </div>
      </div>
      <ul className="min-w-[160px] flex-1 space-y-1.5">
        {rows.map((d, i) => (
          <li key={d.key} className="flex items-center gap-2 text-sm">
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CHART.series[i % CHART.series.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink" title={d.key}>{d.key}</span>
            <span className="shrink-0 text-[13px] tabular-nums text-ink-soft">{fmt(d.value)}</span>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-ink-faint">{fmtPct(total ? d.value / total : 0, 1)}</span>
          </li>
        ))}
        {!rows.length && <li className="text-xs text-ink-faint tabular-nums">No data</li>}
      </ul>
    </div>
  )
}
