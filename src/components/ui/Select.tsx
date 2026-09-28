'use client'
import { useEffect, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string }

/** Themed replacement for a native <select> — the browser's own option list can't be styled. */
export function Select({ value, options, onChange, placeholder = '—', className = '' }: {
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex h-7 w-full items-center justify-between gap-1.5 rounded-md border border-line-strong bg-paper px-2.5 text-[12.5px] font-medium tabular-nums text-ink shadow-card transition-colors hover:bg-paper-2">
        <span className="truncate">{current?.label ?? placeholder}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-ink-faint transition-transform duration-150 ${open ? 'rotate-180' : ''}`}><path d="M2 3.5 5 6.5 8 3.5" /></svg>
      </button>
      {open && (
        <div className="fade-in absolute left-0 z-30 mt-1.5 max-h-64 min-w-[9rem] overflow-auto rounded-lg border border-line bg-paper p-1 shadow-pop">
          {options.map((o) => {
            const active = o.value === value
            return (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false) }}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-[12.5px] tabular-nums transition-colors ${
                  active ? 'bg-navy font-medium text-accent' : 'text-ink-soft hover:bg-paper-2 hover:text-ink'}`}>
                <span className="w-3 shrink-0 text-center">{active ? '✓' : ''}</span>{o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
