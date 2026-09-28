/** Brand mark — stacked ledger bars in an emerald tile. Shared by landing + sidebar. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[8px] bg-accent text-accent-ink shadow-card"
      style={{ width: size, height: size, backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.18), transparent 55%)' }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <rect x="2" y="9" width="3" height="5" rx="1" /><rect x="6.5" y="5.5" width="3" height="8.5" rx="1" /><rect x="11" y="2" width="3" height="12" rx="1" />
      </svg>
    </span>
  )
}
