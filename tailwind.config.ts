import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bone: 'var(--bone)',
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        navy: 'var(--navy)',
        accent: 'var(--accent)',
        'accent-dim': 'var(--accent-dim)',
        'accent-ink': 'var(--accent-ink)',
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        warn: 'var(--warn)',
        steel: 'var(--steel)',
        violet: 'var(--violet)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
