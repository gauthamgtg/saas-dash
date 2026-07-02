export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-line border-l-2 border-l-accent-dim bg-paper/60 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
      {children}
    </p>
  )
}
