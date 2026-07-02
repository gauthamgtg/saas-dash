import { flag } from '@/src/lib/flags'
import { fmtMoney, fmtPct } from '@/src/lib/format'
import { CHART } from '@/src/lib/theme'

/** Revenue-by-country ranked list with flags, bars and share (honest alternative to a choropleth). */
export function GeoPanel({ rows, limit = 7 }: { rows: { key: string; revenue: number; share: number }[]; limit?: number }) {
  const top = rows.slice(0, limit)
  const rest = rows.slice(limit)
  const restRev = rest.reduce((s, r) => s + r.revenue, 0)
  const restShare = rest.reduce((s, r) => s + r.share, 0)
  const max = Math.max(1, ...top.map((r) => r.share))
  const line = (label: string, glyph: string, revenue: number, share: number, i: number) => (
    <div key={label} className="flex items-center gap-3 py-1.5">
      <span className="w-5 shrink-0 text-center text-base leading-none">{glyph}</span>
      <span className="w-28 shrink-0 truncate text-[13px] text-ink" title={label}>{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(share / max) * 100}%`, background: CHART.series[i % CHART.series.length] }} />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-ink-soft">{fmtMoney(revenue)}</span>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-faint">{fmtPct(share, 1)}</span>
    </div>
  )
  return (
    <div className="flex flex-col">
      {top.map((r, i) => line(r.key, flag(r.key), r.revenue, r.share, i))}
      {rest.length > 0 && line(`Others (${rest.length})`, '🌐', restRev, restShare, top.length)}
      {!top.length && <p className="font-mono text-xs text-ink-faint">No data</p>}
    </div>
  )
}
