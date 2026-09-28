'use client'
import { downloadCsv } from '@/src/lib/csv'

/** Standard card: title row (with optional right-hand control + CSV export) + body. */
export function Panel({ title, sub, right, csv, children, className = '', bodyClass = '' }: {
  title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string
  csv?: { filename: string; rows: Record<string, unknown>[] }
}) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-5 shadow-card ${className}`}>
      {(title || right || csv) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h3>}
            {sub && <p className="mt-1 text-[12px] text-ink-faint">{sub}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {right}
            {csv && csv.rows.length > 0 && (
              <button onClick={() => downloadCsv(csv.filename, csv.rows)} title="Download as CSV"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[11.5px] font-medium text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 2.5v7M5 7l3 3 3-3" /><path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" /></svg>
                CSV
              </button>
            )}
          </div>
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}
