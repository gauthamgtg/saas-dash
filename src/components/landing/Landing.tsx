import Link from 'next/link'
import { sampleTransactions } from '@/src/lib/sampleData'
import { buildMatrix, mrrOf, arr, activeCustomers, nrr, movementSeries } from '@/src/lib/engine'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'
import { NAV_ITEMS } from '@/src/lib/nav'
import { Logo } from '@/src/components/ui/Logo'
import { SiteNav } from '@/src/components/layout/SiteNav'
import { HeroUpload, TemplateButton, NavCta, ShareRedirect } from './islands'

// Server-rendered marketing page. Only the upload box, CSV download and nav CTA hydrate.

const Ico = ({ d, size = 16 }: { d: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
)
const UPLOAD = <><path d="M8 10.5V2.5M5 5.5l3-3 3 3" /><path d="M2.5 10.5v2a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" /></>
const ARROW = <path d="M3 8h10M9 4l4 4-4 4" />

const BTN_PRIMARY = 'inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-[14.5px] font-semibold text-accent-ink shadow-card transition-all hover:-translate-y-px hover:shadow-pop'
const BTN_GHOST = 'inline-flex h-11 items-center gap-2 rounded-xl border border-line-strong bg-paper px-5 text-[14.5px] font-medium text-ink shadow-card transition-colors hover:bg-paper-2'

/** Faux app window showing real numbers computed (on the server, at build time) from the sample dataset. */
function ProductPreview() {
  const d = (() => {
    const m = buildMatrix(sampleTransactions(), 'activity')
    const months = m.months
    const last = months[months.length - 1], prev = months[months.length - 2]
    const series = months.map((mo) => mrrOf(m, mo))
    const moves = movementSeries(m, { reactivationGapK: 1 }).slice(-12)
    const mrr = mrrOf(m, last), mrrPrev = mrrOf(m, prev)
    return {
      series, moves, last,
      kpis: [
        { k: 'MRR', v: fmtMoney(mrr), d: mrrPrev ? (mrr - mrrPrev) / mrrPrev : null },
        { k: 'ARR', v: fmtMoneyShort(arr(m, last)), d: null },
        { k: 'Net revenue retention', v: fmtPct(nrr(m, months[Math.max(0, months.length - 13)], last)), d: null },
        { k: 'Active customers', v: String(activeCustomers(m, last)), d: null },
      ],
    }
  })()

  const W = 640, H = 200
  const max = Math.max(...d.series) * 1.08 || 1
  const pts = d.series.map((v, i) => [(i / Math.max(1, d.series.length - 1)) * W, H - (v / max) * H] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const moveMax = Math.max(1, ...d.moves.flatMap((mv) => [mv.newMrr + mv.expansion + mv.reactivation, mv.contraction + mv.churn].map(Math.abs)))

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-pop">
      <div className="flex h-10 items-center gap-2 border-b border-line bg-paper-2 px-4">
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c, opacity: 0.8 }} />)}
        <span className="mx-auto rounded-md border border-line bg-paper px-3 py-0.5 text-[11.5px] text-ink-faint">Ledger · Executive briefing</span>
        <span className="w-12" />
      </div>
      <div className="grid grid-cols-[180px_1fr] max-md:grid-cols-1">
        <aside className="border-r border-line bg-side p-3 max-md:hidden">
          {NAV_ITEMS.slice(0, 11).map((it, i) => (
            <div key={it.id} className={`mb-0.5 flex h-7 items-center gap-2 rounded-md px-2 text-[12px] ${i === 0 ? 'bg-side-active font-medium text-side-ink shadow-card' : 'text-side-soft'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-accent' : 'bg-side-faint opacity-50'}`} />{it.label}
            </div>
          ))}
        </aside>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {d.kpis.map((k) => (
              <div key={k.k} className="rounded-xl border border-line p-3">
                <div className="truncate text-[11.5px] font-medium text-ink-soft">{k.k}</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[20px] font-semibold tabular-nums tracking-[-0.03em] text-ink">{k.v}</span>
                  {k.d != null && (
                    <span className={`text-[11px] font-semibold tabular-nums ${k.d >= 0 ? 'text-pos' : 'text-neg'}`}>{k.d >= 0 ? '↑' : '↓'} {fmtPct(Math.abs(k.d))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-semibold text-ink">MRR trajectory</span>
                <span className="text-ink-faint">{d.series.length} months</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-40 w-full" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="lp-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--line)" strokeDasharray="3 4" />)}
                <path d={`${line} L${W},${H} L0,${H} Z`} fill="url(#lp-fill)" className="fade-in" />
                <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="draw" />
              </svg>
            </div>
            <div className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-semibold text-ink">MRR movement</span>
                <span className="flex items-center gap-2.5 text-ink-faint">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-pos" />In</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-neg" />Out</span>
                </span>
              </div>
              <div className="mt-3 flex h-40 items-center gap-1">
                {d.moves.map((mv) => {
                  const up = mv.newMrr + mv.expansion + mv.reactivation, down = Math.abs(mv.contraction) + Math.abs(mv.churn)
                  return (
                    <div key={mv.month} className="flex flex-1 flex-col items-stretch" title={mv.month}>
                      <div className="flex h-[76px] items-end"><div className="w-full rounded-t-[3px] bg-pos opacity-80" style={{ height: Math.max(2, (up / moveMax) * 76) }} /></div>
                      <div className="h-px bg-line-strong" />
                      <div className="flex h-[76px] items-start"><div className="w-full rounded-b-[3px] bg-neg opacity-70" style={{ height: down ? Math.max(2, (down / moveMax) * 76) : 0 }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEATURES: { title: string; body: string; icon: React.ReactNode; wide?: boolean }[] = [
  { title: 'MRR, movement & ARR bridge', wide: true, body: 'New, expansion, contraction, churn and reactivation — reconciled month by month into a bridge you can hand to a board.', icon: <><path d="M2 12.5l4-4 3 3 5-6.5" /><path d="M10.5 5H14v3.5" /></> },
  { title: 'Cohorts & retention', body: 'NRR, GRR and logo retention by acquisition cohort, with heatmaps and a retention lab.', icon: <><path d="M8 1.5 14 4.5 8 7.5 2 4.5z" /><path d="M2 8 8 11l6-3" /><path d="M2 11.5 8 14.5l6-3" /></> },
  { title: 'Forecast & pipeline', body: 'Project MRR forward and track pipeline alongside booked revenue.', icon: <><path d="M2 12h12" /><path d="M3 10l3-4 3 2 4-5" strokeDasharray="2 2" /></> },
  { title: 'Alerts & data quality', wide: true, body: 'Anomalies are flagged automatically, and bad rows can be fixed before they skew a single metric.', icon: <><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.1v.4" /></> },
  { title: 'Board pack & present mode', wide: true, body: 'A one-screen executive briefing, a board pack, and a distraction-free present mode. Export to PDF.', icon: <><rect x="2" y="3" width="12" height="8.5" rx="1.2" /><path d="M8 11.5V14M5.5 14h5" /></> },
  { title: 'Share, Stripe & Trust pages', body: 'Share a read-only link that carries the data inside the URL. Or connect Stripe in Workspace and publish a public Trust page.', icon: <><path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.6.6" /><path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.6-.6" /></> },
]

const STEPS = [
  { t: 'Drop a file', b: 'Any CSV or Excel export of payment rows — one row per charge or invoice.' },
  { t: 'Confirm the mapping', b: 'Columns auto-detect. Set a date format and FX rates if you bill in several currencies.' },
  { t: 'Analyze', b: 'Metrics compute instantly. Filter by region, plan, period, and compare MoM, QoQ or YoY.' },
]

export function Landing() {
  return (
    <div className="min-h-screen">
      <ShareRedirect />
      <SiteNav links right={<NavCta />} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-18rem] h-[36rem] w-[60rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, color-mix(in srgb, var(--accent) 18%, transparent), transparent)' }} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:pt-24">
          <div className="rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper/80 py-1 pl-1.5 pr-3 text-[12.5px] text-ink-soft shadow-card backdrop-blur">
              <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold text-accent">Private</span>
              Runs entirely in your browser — nothing is uploaded
            </span>
            <h1 className="mt-6 text-[clamp(2.6rem,5.4vw,4.1rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-ink">
              Revenue analytics<br />from a single{' '}
              <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em] text-accent">payments export.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-soft">
              Drop a CSV or Excel file. Ledger maps your columns and computes MRR, retention, cohorts,
              forecasts and a board-ready pack — in seconds, with no sign-up.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/app?demo=1" className={BTN_PRIMARY}>Explore with sample data <Ico size={15} d={ARROW} /></Link>
              <TemplateButton className={BTN_GHOST}>
                <Ico size={15} d={<><path d="M8 2.5v7M5 7l3 3 3-3" /><path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" /></>} />
                CSV template
              </TemplateButton>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-faint">
              {['No account needed', 'CSV, XLSX, XLS', 'Multi-currency FX'].map((f) => (
                <span key={f} className="flex items-center gap-1.5">
                  <span className="text-accent"><Ico size={14} d={<path d="m3.5 8.5 3 3 6-7" />} /></span>{f}
                </span>
              ))}
            </div>
          </div>

          <div id="upload" className="rise scroll-mt-24" style={{ animationDelay: '90ms' }}>
            <HeroUpload />
            <p className="mt-3 text-center text-[12.5px] text-ink-faint">
              Using Stripe? Open the demo, then connect it under <span className="font-medium text-ink-soft">Workspace</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Product preview */}
      <section id="product" className="relative mx-auto max-w-6xl scroll-mt-20 px-6">
        <div className="rise" style={{ animationDelay: '160ms' }}><ProductPreview /></div>
        <p className="mt-3 text-center text-[12.5px] text-ink-faint">Live preview — numbers computed on this page from the bundled sample dataset.</p>
      </section>

      {/* Stat strip */}
      <section className="mx-auto mt-20 max-w-6xl px-6">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4" style={{ gap: 1 }}>
          {[
            { v: '100+', k: 'SaaS metrics computed' },
            { v: String(NAV_ITEMS.length), k: 'Purpose-built views' },
            { v: '0 bytes', k: 'Sent to a server by default' },
            { v: '⌘K', k: 'Jump anywhere, instantly' },
          ].map((s) => (
            <div key={s.k} className="bg-paper px-6 py-6">
              <div className="text-[28px] font-semibold tabular-nums tracking-[-0.04em] text-ink">{s.v}</div>
              <div className="mt-1 text-[13px] text-ink-soft">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
        <div className="max-w-2xl">
          <div className="text-[13px] font-semibold text-accent">Everything a finance team asks for</div>
          <h2 className="mt-2 text-[clamp(2rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink">
            From raw rows to the <span className="font-serif font-normal italic text-accent">numbers that matter.</span>
          </h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className={`group rounded-2xl border border-line bg-paper p-6 shadow-card transition-shadow hover:shadow-pop ${f.wide ? 'md:col-span-2' : ''}`}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-accent transition-transform group-hover:-translate-y-0.5">
                <Ico size={18} d={f.icon} />
              </span>
              <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.015em] text-ink">{f.title}</h3>
              <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
        <div className="text-[13px] font-semibold text-accent">How it works</div>
        <h2 className="mt-2 text-[clamp(2rem,3.6vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-ink">Three steps. About a minute.</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative rounded-2xl border border-line bg-paper p-6 shadow-card">
              <span className="font-serif text-[40px] italic leading-none text-accent">{i + 1}</span>
              <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.015em] text-ink">{s.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">{s.b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy CTA */}
      <section id="privacy" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0c1511] px-8 py-14 text-center md:px-16">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-full opacity-70"
            style={{ background: 'radial-gradient(40rem 18rem at 50% 0%, rgba(52, 211, 154, 0.22), transparent 70%)' }} />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-[clamp(1.9rem,3.4vw,2.6rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-white">
              Your revenue data <span className="font-serif font-normal italic text-[#6ee7b7]">never leaves</span> your browser.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/60">
              Files are parsed and analyzed locally. Cloud features — Stripe sync, Trust pages, file storage — are opt-in and live under Workspace.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/app?demo=1" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[14.5px] font-semibold text-[#0c1511] transition-transform hover:-translate-y-px">
                Explore with sample data <Ico size={15} d={ARROW} />
              </Link>
              <a href="#upload"
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-5 text-[14.5px] font-medium text-white/90 transition-colors hover:bg-white/5">
                <Ico size={15} d={UPLOAD} />Upload your file
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-16 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-8 text-[13px] text-ink-faint">
        <span className="flex items-center gap-2"><Logo size={20} /> Ledger — revenue analytics</span>
        <span>Computed in your browser. Built for founders and finance teams.</span>
      </footer>
    </div>
  )
}
