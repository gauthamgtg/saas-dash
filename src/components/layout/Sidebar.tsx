'use client'
import { useMemo } from 'react'
import { useApp, type ViewId } from '@/src/state/AppContext'
import { findWarnings } from '@/src/lib/issues'
import { applyFilters } from '@/src/lib/dashboard'
import { computeAlerts } from '@/src/lib/alerts'
import { PALETTE_EVENT } from '@/src/components/CommandPalette'

const I = (d: React.ReactNode) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
)

const ICONS: Record<ViewId, React.ReactNode> = {
  briefing: I(<><path d="M9.5 1.5h-5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4.5z" /><path d="M9.5 1.5v3h3" /><path d="M6 8.5h4M6 11h4" /></>),
  board: I(<><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5 6.5h6M5 9h4" /></>),
  arrbridge: I(<><path d="M2 12h12" /><path d="M4 12V7M8 12V4M12 12V8" /></>),
  alerts: I(<><path d="M8 2.5 14 13H2z" /><path d="M8 6.5v3M8 11.1v.4" /></>),
  issues: I(<><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5M8 10.8v.4" /></>),
  overview: I(<><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></>),
  mrr: I(<><path d="M8 1.5v13" /><path d="M11 4H6.5a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H5" /></>),
  growth: I(<><path d="M2 12.5l4-4 3 3 5-6.5" /><path d="M10.5 5H14v3.5" /></>),
  forecast: I(<><path d="M2 12h12" /><path d="M3 10l3-4 3 2 4-5" strokeDasharray="2 2" /></>),
  salesreps: I(<><circle cx="8" cy="5" r="2.5" /><path d="M3.5 13.5a4.5 4.5 0 0 1 9 0" /><path d="M11.5 2.5l3 3M14.5 2.5l-3 3" /></>),
  pipeline: I(<><path d="M2 4h4l2 4 2-4h4" /><path d="M3 12h10" /><path d="M5 8v4M8 8v4M11 8v4" /></>),
  trends: I(<path d="M1.5 8h2.5l2-5 3 10 2-5h3.5" />),
  cohorts: I(<><path d="M8 1.5 14 4.5 8 7.5 2 4.5z" /><path d="M2 8 8 11l6-3" /><path d="M2 11.5 8 14.5l6-3" /></>),
  retention: I(<><path d="M3 12a5 5 0 0 1 10 0" /><circle cx="8" cy="6" r="2.5" /><path d="M11.5 3.5l2 2-2 2" /></>),
  segments: I(<><path d="M8 2a6 6 0 1 0 6 6H8z" /><path d="M10 1.5A6 6 0 0 1 14.5 6H10z" /></>),
  customers: I(<><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 13.5a4.5 4.5 0 0 1 9 0" /><path d="M10 3.2a2.5 2.5 0 1 1 1 4.8" /><path d="M11.5 9.5a4.5 4.5 0 0 1 3 4" /></>),
  health: I(<path d="M8 13.5S2 9.8 2 5.9a3.1 3.1 0 0 1 6-1.2 3.1 3.1 0 0 1 6 1.2c0 3.9-6 7.6-6 7.6z" />),
  risk: I(<><path d="M8 2.5 14 13H2z" /><path d="M8 6v3.5M8 11.2v.3" /></>),
  bins: I(<><path d="M3.5 13V8.5M8 13V3.5M12.5 13V6.5" /><path d="M2 13.5h12" /></>),
  benchmarks: I(<><path d="M2 13.5h12" /><path d="M4.5 13.5V6M8 13.5V2.5M11.5 13.5V6" /><path d="M2 6h12" strokeDasharray="2 2" /></>),
  unitecon: I(<><circle cx="8" cy="8" r="6" /><path d="M8 5v6M9.8 6.2c-.4-.7-3.6-.9-3.6.8s3.8.8 3.6 2.6c-.2 1.5-3.2 1.3-3.8.4" /></>),
  efficiency: I(<><path d="M2 12l4-7 3 4 5-8" /><path d="M11 3h3v3" /></>),
  product: I(<><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M6 8h4M8 6v4" /></>),
  goals: I(<><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><circle cx="8" cy="8" r=".6" fill="currentColor" /></>),
  update: I(<><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="m2.5 4 5.5 4.5L13.5 4" /></>),
  collections: I(<><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" /><path d="M5 9.5h1M7.5 9.5h1M10 9.5h1M5 11.5h1M7.5 11.5h1" /></>),
  churnwarn: I(<><path d="M8 1.5 2.5 4v4c0 3.2 2.4 5.6 5.5 6.5 3.1-.9 5.5-3.3 5.5-6.5V4z" /><path d="M8 5v3.5M8 10.8v.4" /></>),
  expansion: I(<><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><path d="M8 8l4.2-4.2" /></>),
  geo: I(<><circle cx="8" cy="8" r="6" /><path d="M2 8h12" /><path d="M8 2c1.8 1.7 2.7 3.7 2.7 6S9.8 12.3 8 14c-1.8-1.7-2.7-3.7-2.7-6S6.2 3.7 8 2z" /></>),
  connectors: I(<><path d="M6 4.5H4.5a2 2 0 0 0 0 4H6" /><path d="M10 7.5h1.5a2 2 0 0 1 0 4H10" /><path d="M6 6.5h4" /></>),
}

export const NAV_ITEMS: { id: ViewId; label: string; group: string }[] = [
  { id: 'briefing', label: 'Executive Briefing', group: 'Executive' },
  { id: 'board', label: 'Board Pack', group: 'Executive' },
  { id: 'update', label: 'Investor Update', group: 'Executive' },
  { id: 'arrbridge', label: 'ARR Bridge', group: 'Executive' },
  { id: 'alerts', label: 'Alerts', group: 'Executive' },
  { id: 'issues', label: 'Data Issues', group: 'Executive' },
  { id: 'overview', label: 'Overview', group: 'Analysis' },
  { id: 'mrr', label: 'MRR', group: 'Analysis' },
  { id: 'growth', label: 'Growth', group: 'Analysis' },
  { id: 'forecast', label: 'Forecast', group: 'Analysis' },
  { id: 'goals', label: 'Goals & Pacing', group: 'Analysis' },
  { id: 'salesreps', label: 'Sales Reps', group: 'Analysis' },
  { id: 'pipeline', label: 'Pipeline', group: 'Analysis' },
  { id: 'trends', label: 'Trends', group: 'Analysis' },
  { id: 'cohorts', label: 'Cohorts', group: 'Analysis' },
  { id: 'retention', label: 'Retention Lab', group: 'Analysis' },
  { id: 'segments', label: 'Segments', group: 'Analysis' },
  { id: 'geo', label: 'Markets', group: 'Analysis' },
  { id: 'customers', label: 'Customers', group: 'Analysis' },
  { id: 'health', label: 'Customer Health', group: 'Analysis' },
  { id: 'churnwarn', label: 'Churn Warning', group: 'Analysis' },
  { id: 'expansion', label: 'Expansion Radar', group: 'Analysis' },
  { id: 'risk', label: 'Risk & Concentration', group: 'Analysis' },
  { id: 'bins', label: 'Revenue Bins', group: 'Analysis' },
  { id: 'benchmarks', label: 'Benchmarks', group: 'Analysis' },
  { id: 'unitecon', label: 'Unit Economics', group: 'Analysis' },
  { id: 'efficiency', label: 'Efficiency Lab', group: 'Analysis' },
  { id: 'product', label: 'Product & Deferred', group: 'Analysis' },
  { id: 'collections', label: 'Cash Calendar', group: 'Analysis' },
  { id: 'connectors', label: 'Workspace', group: 'Platform' },
]

export function Sidebar() {
  const { state, dispatch } = useApp()
  const issueCount = useMemo(() => {
    const warnings = state.transactions ? findWarnings(state.transactions).filter((w) => !state.dismissedWarningIds.includes(w.id)) : []
    return state.issues.length + warnings.length
  }, [state.transactions, state.issues, state.dismissedWarningIds])

  const alertCount = useMemo(() => {
    if (!state.transactions) return 0
    const txs = applyFilters(state.transactions, state.filters, state.range, state.controls.includeRefunds)
    return computeAlerts(txs, state.controls, state.spend)
      .filter((a) => (a.severity === 'critical' || a.severity === 'warn') && !state.dismissedAlertIds.includes(a.id)).length
  }, [state.transactions, state.filters, state.range, state.controls, state.spend, state.dismissedAlertIds])

  const meta = useMemo(() => {
    const txs = state.transactions ?? []
    if (!txs.length) return null
    let latest = txs[0].date
    for (const t of txs) if (t.date > latest) latest = t.date
    return {
      rows: txs.length,
      customers: new Set(txs.map((t) => t.customerId)).size,
      months: new Set(txs.map((t) => t.month)).size,
      asOf: latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    }
  }, [state.transactions])

  return (
    <nav className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-side-line bg-side px-3 pb-3 pt-4">
      <div className="mb-3 flex items-center gap-2.5 px-1.5">
        <Logo />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold leading-none tracking-tight text-side-ink">Ledger</div>
          <div className="mt-1 truncate text-[11.5px] leading-none text-side-faint">{state.workspace.name}</div>
        </div>
      </div>

      <button onClick={() => window.dispatchEvent(new CustomEvent(PALETTE_EVENT))}
        className="mb-4 flex h-8 w-full items-center gap-2 rounded-lg border border-side-line bg-side-active px-2.5 text-left text-[12.5px] text-side-faint shadow-card transition-colors hover:text-side-soft">
        {I(<><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></>)}
        <span className="flex-1">Search or jump to…</span>
        <kbd className="!border-side-line !bg-side !text-side-faint">⌘K</kbd>
      </button>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {['Executive', 'Analysis', 'Platform'].map((group) => (
          <div key={group} className="mb-3">
            <div className="px-2 pb-1 text-[11px] font-medium text-side-faint">{group}</div>
            {NAV_ITEMS.filter((it) => it.group === group).map((it) => {
              const active = state.view === it.id
              const badge = it.id === 'issues' ? issueCount : it.id === 'alerts' ? alertCount : 0
              return (
                <button key={it.id} onClick={() => dispatch({ type: 'setView', view: it.id })}
                  aria-current={active ? 'page' : undefined}
                  className={`group mb-px flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors ${
                    active ? 'bg-side-active font-medium text-side-ink shadow-card' : 'text-side-soft hover:bg-side-2 hover:text-side-ink'}`}>
                  <span className={active ? 'text-side-accent' : 'text-side-faint transition-colors group-hover:text-side-soft'}>{ICONS[it.id]}</span>
                  <span className="flex-1 truncate">{it.label}</span>
                  {badge > 0 && (
                    <span className="min-w-[20px] rounded-full px-1.5 py-px text-center text-[10.5px] font-medium tabular-nums text-warn"
                      style={{ background: 'color-mix(in srgb, var(--warn) 14%, transparent)' }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {meta && (
        <div className="mt-2 rounded-xl border border-side-line bg-side-active p-3 shadow-card">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-side-soft">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-side-accent opacity-50" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-side-accent" /></span>
            Data as of {meta.asOf}
          </div>
          <div className="mt-1.5 text-[11.5px] tabular-nums text-side-faint">
            {meta.rows.toLocaleString()} rows · {meta.customers.toLocaleString()} accounts · {meta.months} mo
          </div>
          <button onClick={() => dispatch({ type: 'reset' })}
            className="mt-2.5 flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-side-line text-[12px] font-medium text-side-soft transition-colors hover:bg-side-2 hover:text-side-ink">
            {I(<><path d="M8 11V3M5 6l3-3 3 3" /><path d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11" /></>)}
            New upload
          </button>
        </div>
      )}
    </nav>
  )
}

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
