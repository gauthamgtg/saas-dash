'use client'
import { useState } from 'react'

/** File drop target. Calls onFile for both drag-drop and the browse dialog. */
export function DropCard({ onFile, compact }: { onFile: (f: File) => void; compact?: boolean }) {
  const [over, setOver] = useState(false)
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}
      className={`glow-ring group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border bg-paper text-center shadow-pop transition-all ${
        compact ? 'gap-2 p-6' : 'gap-3 p-10'} ${over ? 'scale-[1.01] border-accent' : 'border-line'}`}
      style={over ? { background: 'color-mix(in srgb, var(--accent) 5%, var(--paper))' } : undefined}>
      <span className={`grid place-items-center rounded-2xl bg-navy text-accent transition-transform group-hover:-translate-y-0.5 ${compact ? 'h-10 w-10' : 'h-14 w-14'}`}>
        <svg width={compact ? 18 : 24} height={compact ? 18 : 24} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 10.5V2.5M5 5.5l3-3 3 3" /><path d="M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" />
        </svg>
      </span>
      <div>
        <div className={`font-semibold tracking-[-0.015em] text-ink ${compact ? 'text-[15px]' : 'text-[18px]'}`}>
          {over ? 'Release to import' : 'Drop your payments export'}
        </div>
        <div className="mt-1 text-[13.5px] text-ink-soft">
          or <span className="font-medium text-accent underline decoration-accent/30 underline-offset-4 group-hover:decoration-accent">browse files</span>
        </div>
      </div>
      <div className="mt-1 flex gap-1.5">
        {['.csv', '.xlsx', '.xls'].map((x) => (
          <span key={x} className="rounded-md border border-line bg-paper-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft">{x}</span>
        ))}
      </div>
      <input type="file" accept=".csv,.xlsx,.xls" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </label>
  )
}
