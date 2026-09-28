'use client'

/** Absolute / 100% segmented toggle for stacked charts. */
export function PercentToggle({ percent, onChange }: { percent: boolean; onChange: (v: boolean) => void }) {
  const SEG = 'rounded-md px-2.5 py-1 text-[12px] transition-colors font-medium'
  return (
    <div className="inline-flex items-center rounded-lg border border-line-strong bg-paper p-0.5">
      <button onClick={() => onChange(true)} className={`${SEG} ${percent ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink'}`}>100%</button>
      <button onClick={() => onChange(false)} className={`${SEG} ${!percent ? 'bg-accent text-accent-ink' : 'text-ink-soft hover:text-ink'}`}>Absolute</button>
    </div>
  )
}
