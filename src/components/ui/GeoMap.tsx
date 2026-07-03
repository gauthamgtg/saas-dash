import { fmtMoney, fmtPct } from '@/src/lib/format'

type Row = { key: string; revenue: number; share: number }
type Slot = { match: string[]; label: string; cx: number; cy: number }

// Approximate world positions on a 100×58 canvas — a stylized region cartogram (no heavy map asset).
const SLOTS: Slot[] = [
  { match: ['north america', 'namer', 'usa', 'us', 'canada'], label: 'N. America', cx: 17, cy: 20 },
  { match: ['latam', 'south america', 'latin', 'samer'], label: 'LATAM', cx: 28, cy: 45 },
  { match: ['emea', 'europe', 'eu'], label: 'Europe', cx: 49, cy: 15 },
  { match: ['africa'], label: 'Africa', cx: 52, cy: 38 },
  { match: ['middle east', 'mena'], label: 'Middle East', cx: 60, cy: 27 },
  { match: ['apac', 'asia', 'india', 'china', 'japan', 'sea'], label: 'APAC', cx: 76, cy: 20 },
  { match: ['oceania', 'australia', 'anz', 'nz'], label: 'Oceania', cx: 85, cy: 45 },
]

/** Revenue-by-region bubble map. Bubble size & colour scale with revenue share. */
export function GeoMap({ rows, height = 300 }: { rows: Row[]; height?: number }) {
  const slotData = SLOTS.map((s) => {
    const matched = rows.filter((r) => s.match.some((m) => r.key.toLowerCase().includes(m)))
    return { ...s, revenue: matched.reduce((a, r) => a + r.revenue, 0), share: matched.reduce((a, r) => a + r.share, 0) }
  }).filter((s) => s.revenue > 0)
  const maxShare = Math.max(0.0001, ...slotData.map((s) => s.share))
  const matchedKeys = new Set(SLOTS.flatMap((s) => rows.filter((r) => s.match.some((m) => r.key.toLowerCase().includes(m))).map((r) => r.key)))
  const unmapped = rows.filter((r) => !matchedKeys.has(r.key))

  return (
    <div>
      <div className="w-full overflow-hidden rounded-lg bg-paper-2" style={{ height }}>
        <svg viewBox="0 0 100 58" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* faint reference frame */}
          <rect x="1" y="1" width="98" height="56" rx="3" fill="none" stroke="var(--line)" />
          {slotData.map((s) => {
            const r = 3.2 + (s.share / maxShare) * 11
            return (
              <g key={s.label}>
                <circle cx={s.cx} cy={s.cy} r={r} fill="var(--accent)" fillOpacity={0.18 + (s.share / maxShare) * 0.55} stroke="var(--accent)" strokeOpacity={0.5} strokeWidth={0.4} />
                <text x={s.cx} y={s.cy - r - 1.5} textAnchor="middle" fontSize="3.1" fontFamily="var(--font-mono)" fill="var(--ink-soft)">{s.label}</text>
                <text x={s.cx} y={s.cy + 1.1} textAnchor="middle" fontSize="3.2" fontWeight="600" fontFamily="var(--font-mono)" fill="var(--ink)">{fmtPct(s.share, 0)}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {unmapped.length > 0 && (
        <p className="mt-2 font-mono text-[10px] text-ink-faint">Unmapped: {unmapped.map((u) => `${u.key} (${fmtMoney(u.revenue)})`).join(' · ')}</p>
      )}
    </div>
  )
}
