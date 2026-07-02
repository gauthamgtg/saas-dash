/** Tiny in-cell horizontal bar for leaderboard tables. */
export function MiniBar({ value, max, color = 'var(--accent)', width = 80 }: {
  value: number; max: number; color?: string; width?: number
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  return (
    <span className="inline-block overflow-hidden rounded-full bg-paper-2 align-middle" style={{ width, height: 6 }}>
      <span className="block h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
    </span>
  )
}
