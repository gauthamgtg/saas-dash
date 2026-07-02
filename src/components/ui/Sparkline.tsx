/** Tiny inline area+line sparkline. No axes, no deps — pure SVG. */
export function Sparkline({
  data, color = 'var(--accent)', w = 96, h = 30,
}: { data: number[]; color?: string; w?: number; h?: number }) {
  const pts = data.filter((v) => Number.isFinite(v))
  if (pts.length < 2) return <svg width={w} height={h} aria-hidden />
  const min = Math.min(...pts), max = Math.max(...pts)
  const span = max - min || 1
  const dx = w / (pts.length - 1)
  const y = (v: number) => h - 2 - ((v - min) / span) * (h - 4)
  const line = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * dx).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  const id = `sp${Math.round(pts[0] + pts.length + max)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={y(pts[pts.length - 1])} r="2" fill={color} />
    </svg>
  )
}
