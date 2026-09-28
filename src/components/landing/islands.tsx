'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DropCard } from '@/src/components/upload/DropCard'
import { WorldMap } from '@/src/components/ui/WorldMap'
import { setPendingFile } from '@/src/lib/pendingImport'
import { downloadCsv } from '@/src/lib/csv'
import { sampleCsvRows } from '@/src/lib/sampleData'
import { STORAGE_KEY } from '@/src/state/keys'

// Interactive bits of the otherwise server-rendered landing page.

const ARROW = <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 8h10M9 4l4 4-4 4" /></svg>

/** Drop a file here → carried to /app, where the import wizard picks it up. */
export function HeroUpload() {
  const router = useRouter()
  return <DropCard onFile={(f) => { setPendingFile(f); router.push('/app') }} />
}

export function TemplateButton({ className, children }: { className: string; children: React.ReactNode }) {
  return <button onClick={() => downloadCsv('ledger-sample-template', sampleCsvRows())} className={className}>{children}</button>
}

/** "Open dashboard" for returning users with saved data, "Open demo" for everyone else. */
export function NavCta() {
  const [saved, setSaved] = useState(false)
  useEffect(() => { try { setSaved(!!localStorage.getItem(STORAGE_KEY)) } catch {} }, [])
  return (
    <Link href={saved ? '/app' : '/app?demo=1'}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-medium text-bone shadow-card transition-opacity hover:opacity-90">
      {saved ? 'Open dashboard' : 'Open demo'} {ARROW}
    </Link>
  )
}

/** Share links used to live at /#s=… — forward them to the dashboard. */
export function ShareRedirect() {
  useEffect(() => { if (location.hash.startsWith('#s=')) location.replace(`/app${location.hash}`) }, [])
  return null
}

/** World map for the markets card: plain props from the server → the client WorldMap. */
export function LandingMap({ rows }: { rows: { key: string; label: string; t: number; title: string; dot: { lat: number; lon: number } | null }[] }) {
  const [hover, setHover] = useState<string | null>(null)
  const fill = (t: number) => `color-mix(in srgb, var(--accent) ${Math.round(22 + t * 78)}%, var(--paper))`
  const values = new Map(rows.map((r) => [r.key, { label: r.label, fill: fill(r.t), title: r.title }]))
  const points = rows.flatMap((r) => (r.dot ? [{ key: r.key, lat: r.dot.lat, lon: r.dot.lon, fill: fill(r.t), title: r.title }] : []))
  const hovered = rows.find((r) => r.key === hover)
  return (
    <div className="relative">
      <WorldMap values={values} points={points} hovered={hover} onHover={setHover} />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-line bg-paper/90 px-2.5 py-1.5 text-[12px] text-ink-soft shadow-card backdrop-blur">
        {hovered ? hovered.title : 'Hover a country'}
      </div>
    </div>
  )
}
