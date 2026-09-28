import type { Config } from 'tailwindcss'

// CSS-var colors with working opacity modifiers (bg-accent/20 etc.): Tailwind fills <alpha-value> (1 when unset).
const v = (name: string) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`

export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bone: v('--bone'),
        paper: v('--paper'),
        'paper-2': v('--paper-2'),
        ink: v('--ink'),
        'ink-soft': v('--ink-soft'),
        'ink-faint': v('--ink-faint'),
        line: v('--line'),
        'line-strong': v('--line-strong'),
        navy: v('--navy'),
        accent: v('--accent'),
        'accent-dim': v('--accent-dim'),
        'accent-ink': v('--accent-ink'),
        pos: v('--pos'),
        neg: v('--neg'),
        warn: v('--warn'),
        steel: v('--steel'),
        violet: v('--violet'),
        side: v('--side-bg'),
        'side-2': v('--side-bg-2'),
        'side-ink': v('--side-ink'),
        'side-soft': v('--side-soft'),
        'side-faint': v('--side-faint'),
        'side-line': v('--side-line'),
        'side-accent': v('--side-accent'),
        'side-active': v('--side-active'),
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
