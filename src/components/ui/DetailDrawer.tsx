'use client'
import { useEffect } from 'react'

export type DrillRow = { name: string; value: string; sub?: string; tone?: 'pos' | 'neg' | 'default' }
export type Drill = { title: string; subtitle?: string; rows: DrillRow[] } | null

/** Right-hand slide-over listing the accounts behind a clicked aggregate (KPI / bin / cohort / movement). */
export function DetailDrawer({ drill, onClose }: { drill: Drill; onClose: () => void }) {
  useEffect(() => {
    if (!drill) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [drill, onClose])

  if (!drill) return null
  const color = (t?: string) => (t === 'pos' ? 'text-pos' : t === 'neg' ? 'text-neg' : 'text-ink')
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line-strong bg-paper shadow-pop">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">{drill.title}</h3>
            {drill.subtitle && <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-ink-soft">{drill.subtitle}</p>}
          </div>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md border border-line-strong text-ink-soft hover:bg-paper-2 hover:text-ink">✕</button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
          {drill.rows.length ? (
            <ul className="divide-y divide-line">
              {drill.rows.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink">{r.name}</div>
                    {r.sub && <div className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">{r.sub}</div>}
                  </div>
                  <span className={`shrink-0 font-mono text-[13px] tabular-nums ${color(r.tone)}`}>{r.value}</span>
                </li>
              ))}
            </ul>
          ) : <p className="px-4 py-6 text-center font-mono text-xs text-ink-faint">No accounts</p>}
        </div>
        <footer className="border-t border-line px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-ink-faint">{drill.rows.length} accounts · Esc to close</footer>
      </aside>
    </div>
  )
}
