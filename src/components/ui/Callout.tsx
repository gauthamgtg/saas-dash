export function Callout({ children, tone = 'neutral' }: {
  children: React.ReactNode
  tone?: 'neutral' | 'pos' | 'warn' | 'neg'
}) {
  const border = {
    neutral: 'var(--accent)',
    pos: 'var(--pos)',
    warn: 'var(--warn)',
    neg: 'var(--neg)',
  }[tone]
  return (
    <p className="flex gap-2.5 rounded-xl border border-line px-4 py-3 text-[13px] leading-relaxed text-ink-soft"
      style={{ background: `color-mix(in srgb, ${border} 6%, var(--paper))`, borderColor: `color-mix(in srgb, ${border} 22%, var(--line))` }}>
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: border }} />
      <span>{children}</span>
    </p>
  )
}
