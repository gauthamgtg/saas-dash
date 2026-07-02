import type { Config } from 'tailwindcss'
export default {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bone: 'var(--bone)',
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        'ink-faint': 'var(--ink-faint)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        navy: 'var(--navy)',
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        warn: 'var(--warn)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
