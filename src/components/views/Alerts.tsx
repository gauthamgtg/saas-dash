'use client'
import { useMemo } from 'react'
import { useApp, type ViewId } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { computeAlerts, type AlertSeverity } from '@/src/lib/alerts'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'

const SEV: Record<AlertSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'var(--neg)', bg: 'color-mix(in srgb, var(--neg) 12%, transparent)' },
  warn: { label: 'Watch', color: 'var(--warn)', bg: 'color-mix(in srgb, var(--warn) 12%, transparent)' },
  info: { label: 'Info', color: 'var(--steel)', bg: 'color-mix(in srgb, var(--steel) 12%, transparent)' },
  good: { label: 'Healthy', color: 'var(--pos)', bg: 'color-mix(in srgb, var(--pos) 12%, transparent)' },
}

export function Alerts() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const all = useMemo(() => computeAlerts(txs, state.controls, state.spend), [txs, state.controls, state.spend])
  const alerts = all.filter((a) => !state.dismissedAlertIds.includes(a.id))
  const counts = {
    critical: alerts.filter((a) => a.severity === 'critical').length,
    warn: alerts.filter((a) => a.severity === 'warn').length,
    info: alerts.filter((a) => a.severity === 'info').length,
    good: alerts.filter((a) => a.severity === 'good').length,
  }

  return (
    <div className="space-y-4">
      <ViewHeader
        index="01" kicker="Monitoring" title="Alerts"
        sub="Rule-based checks across retention, churn, concentration, efficiency, and growth quality"
        actions={
          alerts.length > 0 ? (
            <button onClick={() => dispatch({ type: 'dismissAlerts', ids: alerts.map((a) => a.id) })}
              className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2 font-medium">
              Dismiss all
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-4 [&>*]:border-0">
        {(['critical', 'warn', 'info', 'good'] as AlertSeverity[]).map((s) => (
          <div key={s} className="bg-paper px-4 py-3">
            <div className="text-[12px] font-medium" style={{ color: SEV[s].color }}>{SEV[s].label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-ink">{counts[s]}</div>
          </div>
        ))}
      </div>

      {!alerts.length ? (
        <Panel>
          <p className="py-8 text-center text-sm text-ink-faint tabular-nums">
            {all.length ? 'All alerts dismissed. Reload or change filters to refresh.' : 'No alerts — metrics look calm under current rules.'}
          </p>
        </Panel>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const s = SEV[a.severity]
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-line bg-paper p-4"
                style={{ borderLeftWidth: 3, borderLeftColor: s.color }}>
                <span className="mt-0.5 shrink-0 rounded px-2 py-0.5 text-[11px] font-medium"
                  style={{ color: s.color, background: s.bg }}>{s.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{a.title}</div>
                  <p className="mt-0.5 text-sm text-ink-soft">{a.detail}</p>
                  {a.view && (
                    <button onClick={() => dispatch({ type: 'setView', view: a.view as ViewId })}
                      className="mt-2 text-[12px] text-side-accent hover:opacity-80 font-medium">
                      Open {a.view} →
                    </button>
                  )}
                </div>
                <button onClick={() => dispatch({ type: 'dismissAlerts', ids: [a.id] })}
                  className="shrink-0 text-[12px] text-ink-faint hover:text-ink font-medium">
                  Dismiss
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
