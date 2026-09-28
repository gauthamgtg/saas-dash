'use client'
import { useEffect, useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, get, movementEvents, atRisk, recencyDays } from '@/src/lib/engine'
import { TrendChart } from './TrendChart'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtPct, fmtNum } from '@/src/lib/format'

const TYPE = {
  new: { label: 'New', color: 'var(--pos)', glyph: '+' }, expansion: { label: 'Expansion', color: 'var(--steel)', glyph: '↑' },
  reactivation: { label: 'Reactivated', color: 'var(--violet)', glyph: '↺' }, contraction: { label: 'Downgrade', color: 'var(--warn)', glyph: '↓' },
  churn: { label: 'Churned', color: 'var(--neg)', glyph: '✕' },
} as const
const pill = (color: string, label: string) => (
  <span className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>{label}</span>
)
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Slide-over "customer 360": every signal we can derive about one account from its payments. */
export function AccountProfile({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { state } = useApp()
  useEffect(() => {
    if (!customerId) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [customerId, onClose])

  const d = useMemo(() => {
    if (!customerId) return null
    const txs = applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds)
    const mine = txs.filter((t) => t.customerId === customerId).sort((a, b) => b.date.getTime() - a.date.getTime())
    if (!mine.length) return null
    const m = buildMatrix(txs, state.controls.mode)
    const last = m.months[m.months.length - 1]
    const series = m.months.map((mo) => ({ month: mo, MRR: Math.round(get(m, customerId, mo)) }))
    const firstIdx = series.findIndex((r) => r.MRR !== 0)
    const trimmed = series.slice(Math.max(0, firstIdx))
    const asOf = new Date(Math.max(...txs.map((t) => t.date.getTime())))
    const lifetime = mine.reduce((s, t) => s + t.amountBase, 0)
    const refunds = mine.filter((t) => t.amountBase < 0).reduce((s, t) => s - t.amountBase, 0)
    const gross = mine.filter((t) => t.amountBase > 0).reduce((s, t) => s + t.amountBase, 0)
    const recency = recencyDays(txs, customerId, asOf)
    const current = get(m, customerId, last)
    const first = mine[mine.length - 1].date
    const tenure = Math.max(1, Math.round((mine[0].date.getTime() - first.getTime()) / (30.44 * 864e5)) + 1)
    const pick = <K extends 'plan' | 'region' | 'country' | 'salesRep' | 'businessModel' | 'currency'>(k: K) => mine.find((t) => t[k])?.[k] ?? null
    const status = current === 0 ? { c: 'var(--neg)', l: 'Churned' }
      : atRisk(m, customerId, state.controls.atRiskStreak) ? { c: 'var(--neg)', l: 'At risk' }
      : recency != null && recency > state.controls.dormancyDays ? { c: 'var(--warn)', l: 'Dormant' }
      : { c: 'var(--pos)', l: 'Active' }
    return {
      name: mine.find((t) => t.name)?.name ?? customerId, mine, trimmed, lifetime, refunds, current, tenure, first, status,
      peak: Math.max(...trimmed.map((r) => r.MRR)), refundRate: gross ? refunds / gross : null, recency,
      meta: [pick('plan'), pick('businessModel'), [pick('country'), pick('region')].filter(Boolean).join(', ') || null, pick('salesRep'), pick('currency')].filter((x, i, arr): x is string => !!x && !arr.slice(0, i).some((y) => y?.startsWith(x))),
      events: movementEvents(m, txs, state.controls.reactivationGapK).filter((e) => e.customerId === customerId),
    }
  }, [customerId, state.transactions, state.filters, state.range, state.controls])

  if (!customerId) return null
  const color = CHART.series[Math.abs([...(d?.name ?? customerId)].reduce((s, ch) => s + ch.charCodeAt(0), 0)) % CHART.series.length]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fade-in absolute inset-0 bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside role="dialog" aria-label="Account profile" className="slide-in relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-bone shadow-pop">
        <header className="flex items-start gap-4 border-b border-line bg-paper px-6 py-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[20px] font-semibold text-white shadow-card" style={{ background: color }}>{(d?.name ?? customerId).slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">{d?.name ?? customerId}</h2>
              {d && pill(d.status.c, d.status.l)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-faint">
              <span className="tabular-nums">{customerId}</span>
              {d?.meta.map((x) => <span key={x}>· {x}</span>)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-line-strong text-ink-soft hover:bg-paper-2 hover:text-ink">✕</button>
        </header>

        {!d ? <p className="p-6 text-sm text-ink-faint">No payments for this account in the current filters.</p> : (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card">
              {[
                ['Current MRR', fmtMoney(d.current)], ['Peak MRR', fmtMoney(d.peak)], ['Lifetime revenue', fmtMoney(d.lifetime)],
                ['Customer since', fmtDate(d.first)], ['Payments', `${fmtNum(d.mine.length)} · ${d.tenure} mo`], ['Refund rate', fmtPct(d.refundRate)],
              ].map(([k, v]) => (
                <div key={k} className="bg-paper p-4">
                  <div className="text-[12px] font-medium text-ink-soft">{k}</div>
                  <div className="mt-1.5 truncate text-[18px] font-semibold tracking-[-0.02em] tabular-nums text-ink">{v}</div>
                </div>
              ))}
            </div>

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-card">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-[14.5px] font-semibold text-ink">MRR history</h3>
                <span className="text-[12px] text-ink-faint">{d.recency != null ? `last paid ${d.recency}d ago` : ''}</span>
              </div>
              <TrendChart data={d.trimmed} xKey="month" area height={180} series={[{ key: 'MRR', color }]} />
            </section>

            {d.events.length > 0 && (
              <section className="rounded-2xl border border-line bg-paper p-5 shadow-card">
                <h3 className="mb-3 text-[14.5px] font-semibold text-ink">Revenue timeline</h3>
                <ol className="relative space-y-3 border-l border-line pl-5">
                  {d.events.map((e, i) => {
                    const t = TYPE[e.type]
                    return (
                      <li key={i} className="relative flex items-center justify-between gap-3 text-[13.5px]">
                        <span className="absolute -left-[31px] grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ring-4 ring-paper" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 16%, var(--paper))` }}>{t.glyph}</span>
                        <span><span className="font-medium text-ink">{t.label}</span> <span className="text-ink-faint">· {e.month}</span></span>
                        <span className={`font-semibold tabular-nums ${e.amount >= 0 ? 'text-pos' : 'text-neg'}`}>{e.amount >= 0 ? '+' : '−'}{fmtMoney(Math.abs(e.amount))}</span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}

            <section className="rounded-2xl border border-line bg-paper p-5 shadow-card">
              <h3 className="mb-2 text-[14.5px] font-semibold text-ink">Payments <span className="font-normal text-ink-faint">· latest {Math.min(15, d.mine.length)} of {d.mine.length}</span></h3>
              <table className="w-full text-[13.5px] tabular-nums">
                <thead><tr className="text-left text-[12px] text-ink-faint">
                  <th className="py-2 font-medium">Date</th><th className="py-2 font-medium">Invoice</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
                <tbody>
                  {d.mine.slice(0, 15).map((t) => (
                    <tr key={t.paymentId} className="border-t border-line">
                      <td className="py-2 text-ink-soft">{fmtDate(t.date)}</td>
                      <td className="py-2 text-ink-faint">{t.invoiceNumber ?? '—'}</td>
                      <td className={`py-2 text-right font-medium ${t.amountBase < 0 ? 'text-neg' : 'text-ink'}`}>
                        {t.isRefund && <span className="mr-2 rounded px-1.5 py-px text-[11px] text-neg" style={{ background: 'color-mix(in srgb, var(--neg) 10%, transparent)' }}>refund</span>}
                        {fmtMoney(t.amountBase)}
                        {t.currency && t.amountNative !== t.amountBase && <span className="ml-1.5 text-[11.5px] font-normal text-ink-faint">{t.amountNative.toLocaleString('en-US')} {t.currency}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}
