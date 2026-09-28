import { getPublicTrust } from '@/src/server/repo'
import { notFound } from 'next/navigation'
import { fmtMoneyShort } from '@/src/lib/format'

type Props = { params: Promise<{ slug: string }> }

/** Embeddable badge — open in iframe. */
export default async function BadgePage({ params }: Props) {
  const { slug } = await params
  const trust = await getPublicTrust(slug)
  if (!trust) notFound()
  const ccy = trust.currency === 'USD' ? '$' : `${trust.currency} `
  return (
    <div className="grid min-h-screen place-items-center bg-transparent p-4">
      <a href={`/trust/${trust.publicSlug}`} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2.5 rounded-[10px] border border-line-strong bg-paper px-3.5 py-2.5 text-ink shadow-card no-underline">
        <span className="h-2 w-2 rounded-full bg-pos shadow-[0_0_0_3px_color-mix(in_srgb,var(--pos)_20%,transparent)]" />
        <span>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">Verified MRR · Ledger</div>
          <div className="font-display text-lg font-bold tabular-nums">{fmtMoneyShort(trust.verifiedMrr, ccy)}</div>
        </span>
      </a>
    </div>
  )
}
