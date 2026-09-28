/**
 * MRRmark brand. The mark is an "M" drawn as an MRR sparkline, its higher peak marked with a dot — the high-water mark.
 * Keep in sync with app/icon.svg (favicon), which inlines the same geometry.
 */
export function Mark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 19 7.5 10l4.5 5.5 4.5-10L20.5 19" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16.5" cy="5.5" r="2.7" fill="currentColor" />
    </svg>
  )
}

/** Mark in the emerald tile. Shared by landing + sidebar. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[8px] bg-accent text-accent-ink shadow-card"
      style={{ width: size, height: size, backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.18), transparent 55%)' }}>
      <Mark size={size * 0.68} />
    </span>
  )
}

/** "MRR" + "mark" wordmark; size and base colour come from the caller's className. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={className}>MRR<span className="font-medium text-accent">mark</span></span>
}
