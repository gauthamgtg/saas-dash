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
        className="grid h-7 w-7 place-items-center rounded-md border border-line-strong text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink">
        {isDark ? '☀' : '☾'}
      </button>
    )
  }
  return (
    <div className="inline-flex rounded-lg border border-line-strong bg-paper p-0.5">
      {(['light', 'dark'] as Theme[]).map((t) => (
        <button key={t} onClick={() => set(t)}
          className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
            theme === t ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink'}`}>
          {t === 'light' ? '☀ Light' : '☾ Dark'}
        </button>
      ))}
    </div>
  )
}
