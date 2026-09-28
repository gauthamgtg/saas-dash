import { fmtMoney, fmtMoneyShort, fmtNum } from '@/src/lib/format'

export function TrustPage(props: {
  companyName: string
  website: string | null
  verifiedMrr: number
  verifiedArr: number
  customerCount: number
  sparkline: number[]
  currency: string
  source: string
  lastVerifiedAt: string | null
  publicSlug: string
}) {
  const ccy = props.currency === 'USD' ? '$' : `${props.currency} `
  const max = Math.max(1, ...props.sparkline)
  const verifiedLabel = props.source === 'stripe' ? 'Stripe-verified' : props.source === 'hybrid' ? 'Hybrid-verified' : 'Ledger-verified'
  const when = props.lastVerifiedAt
    ? new Date(props.lastVerifiedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-10 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-xl font-semibold tracking-[-0.03em] text-accent-ink shadow-card">L</div>
          <div>
            <div className="font-display text-[15px] font-bold tracking-tight">Ledger Trust</div>
            <div className="text-[11px] text-ink-soft font-medium">Public source of truth</div>
          </div>
        </div>

        <header className="border-b border-line-strong pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-pos/30 bg-pos/10 px-3 py-1 text-[12px] text-pos font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-pos" /> {verifiedLabel}
          </div>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{props.companyName}</h1>
          {props.website && (
            <a href={props.website} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-side-accent hover:underline">{props.website.replace(/^https?:\/\//, '')}</a>
          )}
          {when && <p className="mt-2 text-[11px] text-ink-faint tabular-nums">Last verified {when}</p>}
        </header>

        <section className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          <div className="bg-paper p-6">
            <div className="text-[12px] text-ink-soft font-medium">MRR</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{fmtMoneyShort(props.verifiedMrr, ccy)}</div>
          </div>
          <div className="bg-paper p-6">
            <div className="text-[12px] text-ink-soft font-medium">ARR</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{fmtMoneyShort(props.verifiedArr, ccy)}</div>
          </div>
          <div className="bg-paper p-6">
            <div className="text-[12px] text-ink-soft font-medium">Customers</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">{fmtNum(props.customerCount)}</div>
          </div>
        </section>

        {props.sparkline.length > 1 && (
          <section className="mt-8 rounded-2xl border border-line bg-paper p-6">
            <div className="mb-4 text-[12px] text-ink-soft font-medium">MRR sparkline</div>
            <svg viewBox={`0 0 ${props.sparkline.length * 24} 80`} className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
              <polyline
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={props.sparkline.map((v, i) => `${i * 24 + 12},${76 - (v / max) * 64}`).join(' ')}
              />
              {props.sparkline.map((v, i) => (
                <circle key={i} cx={i * 24 + 12} cy={76 - (v / max) * 64} r="2.5" fill="var(--accent)" />
              ))}
            </svg>
            <p className="mt-2 text-[11px] text-ink-faint tabular-nums">
              Exact: {fmtMoney(props.verifiedMrr, ccy)} MRR · {fmtMoney(props.verifiedArr, ccy)} ARR
            </p>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-line bg-paper p-6 text-sm text-ink-soft">
          <p>
            These figures are published through <strong className="text-ink">Ledger Trust</strong>.
            {props.source === 'stripe'
              ? ' MRR is computed server-side from active Stripe subscriptions via a read-only key — the founder cannot edit the number on this page.'
              : ' Numbers were published from a Ledger workspace. Connect Stripe for cryptographic verification.'}
          </p>
          <p className="mt-3 text-[11px] text-ink-faint tabular-nums">/{props.publicSlug}</p>
        </section>

        <footer className="mt-12 border-t border-line pt-6 text-[12px] text-ink-faint font-medium">
          Ledger · Verified revenue · Not financial advice
        </footer>
      </div>
    </main>
  )
}
