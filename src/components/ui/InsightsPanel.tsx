import type { Insight } from '@/src/lib/insights'

const GLYPH: Record<string, string> = {
  'trend-up': '↗', 'trend-down': '↘', award: '★', 'shield-check': '⛨', shield: '⛨',
  alert: '!', target: '◎', sparkle: '✦', globe: '⊕',
}
const toneColor: Record<Insight['tone'], string> = { pos: 'var(--pos)', neg: 'var(--neg)', neutral: 'var(--accent)' }
const tint = (c: string) => `color-mix(in srgb, ${c} 14%, transparent)`

/** Auto-generated insight rows (the reference "Insights" panel). */
export function InsightsPanel({ items }: { items: Insight[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => {
        const c = toneColor[it.tone]
        return (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md font-mono text-xs"
              style={{ color: c, background: tint(c) }}>{GLYPH[it.icon] ?? '•'}</span>
            <p className="text-[13px] leading-snug text-ink-soft">{it.text}</p>
          </li>
        )
      })}
      {!items.length && <li className="font-mono text-xs text-ink-faint">No insights yet</li>}
    </ul>
  )
}
