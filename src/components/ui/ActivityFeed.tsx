import type { RevEvent, RevEventType } from '@/src/lib/engine/events'
import { fmtMoney } from '@/src/lib/format'

const STYLE: Record<RevEventType, { glyph: string; color: string; label: string }> = {
  new: { glyph: '+', color: 'var(--pos)', label: 'New' },
  expansion: { glyph: '↑', color: 'var(--steel)', label: 'Expansion' },
  reactivation: { glyph: '↺', color: 'var(--violet)', label: 'Reactivated' },
  contraction: { glyph: '↓', color: 'var(--warn)', label: 'Contraction' },
  churn: { glyph: '✕', color: 'var(--neg)', label: 'Churned' },
}
const tint = (c: string) => `color-mix(in srgb, ${c} 14%, transparent)`

/** Baremetrics-style activity feed of individual revenue movements. */
export function ActivityFeed({ events, limit = 12 }: { events: RevEvent[]; limit?: number }) {
  const rows = events.slice(0, limit)
  return (
    <ul className="divide-y divide-line">
      {rows.map((e, i) => {
        const s = STYLE[e.type]
        return (
          <li key={i} className="flex items-center gap-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-xs"
              style={{ color: s.color, background: tint(s.color) }}>{s.glyph}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-ink">{e.name ?? e.customerId}</div>
              <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{s.label} · {e.month}</div>
            </div>
            <span className="shrink-0 font-mono text-[13px] tabular-nums" style={{ color: e.amount >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {e.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(e.amount))}
            </span>
          </li>
        )
      })}
      {!rows.length && <li className="py-2 font-mono text-xs text-ink-faint">No movements in range</li>}
    </ul>
  )
}
