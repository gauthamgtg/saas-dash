'use client'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

function current(): Theme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => setTheme(current()), [])

  function set(next: Theme) {
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('ledger-theme', next) } catch {}
    setTheme(next)
  }

  const isDark = theme === 'dark'
  if (compact) {
    return (
      <button onClick={() => set(isDark ? 'light' : 'dark')} title="Toggle theme"
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong bg-paper text-ink-soft shadow-card transition-colors hover:bg-paper-2 hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          {isDark
            ? <><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" /></>
            : <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" />}
        </svg>
      </button>
    )
  }
  return (
    <div className="inline-flex rounded-lg border border-line-strong bg-paper p-0.5">
      {(['light', 'dark'] as Theme[]).map((t) => (
        <button key={t} onClick={() => set(t)}
          className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
            theme === t ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink'}`}>
          {t === 'light' ? '☀ Light' : '☾ Dark'}
        </button>
      ))}
    </div>
  )
}
