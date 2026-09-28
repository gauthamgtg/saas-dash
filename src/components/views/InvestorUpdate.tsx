'use client'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arpa, nrr, logoChurnRate, activeCustomers, movementSeries, movementEvents } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { insights } from '@/src/lib/insights'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { Select } from '@/src/components/ui/Select'
import { fmtMoney, fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'

const KEY = 'ledger-update-notes'
const TEXTAREA = 'w-full rounded-xl border border-line-strong bg-paper px-3 py-2.5 text-[13.5px] leading-relaxed text-ink shadow-card outline-none focus:border-accent'
const BTN = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3.5 text-[13px] font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2 hover:text-ink'
const rel = (a: number, b: number) => (b ? (a - b) / b : null)
const signed = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${fmtMoney(Math.abs(n))}`)
const pctDelta = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${fmtPct(Math.abs(n))}`)
const monthName = (mo: string) => new Date(`${mo}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

type Row = { k: string; v: string; prev: string; d: string; good: boolean | null }

export function InvestorUpdate() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const [month, setMonth] = useState('')
  const cur = month || m.months[m.months.length - 1] || ''

  const [notes, setNotes] = useState({ company: '', wins: '', asks: '' })
  useEffect(() => { try { const n = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (n) setNotes(n) } catch {} }, [])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(notes)) } catch {} }, [notes])
  const company = notes.company || state.workspace.name

  const [copied, setCopied] = useState('')

  const d = useMemo(() => {
    if (!cur) return null
    const prev = addMonths(cur, -1)
    const mrr = mrrOf(m, cur), pMrr = mrrOf(m, prev)
    const yearAgo = addMonths(cur, -12)
    const hasYear = m.months.includes(yearAgo)
    const series = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    const net = series.find((x) => x.month === cur)?.netNew ?? null
    const pNet = series.find((x) => x.month === prev)?.netNew ?? null
    const churn = logoChurnRate(m, prev, cur), pChurn = logoChurnRate(m, addMonths(prev, -1), prev)
    const a = arpa(m, cur), pa = arpa(m, prev)
    const act = activeCustomers(m, cur), pAct = activeCustomers(m, prev)
    const n = hasYear ? nrr(m, yearAgo, cur) : nrr(m, prev, cur)

    const rows: Row[] = [
      { k: 'MRR', v: fmtMoney(mrr), prev: fmtMoney(pMrr), d: pctDelta(rel(mrr, pMrr)), good: pMrr ? mrr >= pMrr : null },
      { k: 'ARR', v: fmtMoneyShort(mrr * 12), prev: fmtMoneyShort(pMrr * 12), d: pctDelta(rel(mrr, pMrr)), good: pMrr ? mrr >= pMrr : null },
      { k: 'Net new MRR', v: signed(net), prev: signed(pNet), d: '', good: net == null ? null : net >= 0 },
      { k: 'Active customers', v: fmtNum(act), prev: fmtNum(pAct), d: act - pAct ? `${act - pAct > 0 ? '+' : '−'}${Math.abs(act - pAct)}` : '0', good: act >= pAct },
      { k: 'ARPA', v: fmtMoney(a), prev: fmtMoney(pa), d: pctDelta(a != null && pa ? rel(a, pa) : null), good: a != null && pa != null ? a >= pa : null },
      { k: hasYear ? 'NRR (12-mo)' : 'NRR (MoM)', v: fmtPct(n), prev: '', d: '', good: n == null ? null : n >= 1 },
      { k: 'Logo churn (MoM)', v: fmtPct(churn), prev: fmtPct(pChurn), d: '', good: churn != null && pChurn != null ? churn <= pChurn : null },
    ]

    const events = movementEvents(m, txs, state.controls.reactivationGapK).filter((e) => e.month === cur)
    const label = { new: 'New', expansion: 'Expansion', reactivation: 'Reactivated', contraction: 'Downgrade', churn: 'Churned' }
    const ev = (e: (typeof events)[number]) => ({ name: e.name ?? e.customerId, type: label[e.type], amount: e.amount })
    const wins = events.filter((e) => e.amount > 0).slice(0, 4).map(ev)
    const losses = events.filter((e) => e.amount < 0).slice(0, 4).map(ev)
    const auto = insights(txs.filter((t) => t.month <= cur), state.controls).slice(0, 4).map((i) => i.text)
    return { prev, mrr, pMrr, rows, wins, losses, auto }
  }, [m, cur, txs, state.controls])

  const markdown = useMemo(() => {
    if (!d) return ''
    const L: string[] = []
    L.push(`# ${company} — ${monthName(cur)} update`, '')
    L.push(`**TL;DR:** MRR ${d.mrr >= d.pMrr ? 'grew' : 'declined'} to ${fmtMoney(d.mrr)} (${pctDelta(rel(d.mrr, d.pMrr))} MoM), ${fmtMoneyShort(d.mrr * 12)} ARR.`, '')
    L.push('## Key metrics', '', `| Metric | ${cur} | ${d.prev} | Δ |`, '|---|---:|---:|---:|')
    for (const r of d.rows) L.push(`| ${r.k} | ${r.v} | ${r.prev || '—'} | ${r.d || '—'} |`)
    L.push('')
    if (notes.wins.trim()) L.push('## Highlights', '', ...notes.wins.trim().split('\n').map((x) => `- ${x.replace(/^[-•]\s*/, '')}`), '')
    if (d.wins.length) L.push('## Revenue wins', '', ...d.wins.map((w) => `- **${w.name}** — ${w.type.toLowerCase()} ${signed(w.amount)} MRR`), '')
    if (d.losses.length) L.push('## Revenue losses', '', ...d.losses.map((w) => `- **${w.name}** — ${w.type.toLowerCase()} ${signed(w.amount)} MRR`), '')
    if (d.auto.length) L.push('## What the numbers say', '', ...d.auto.map((t) => `- ${t}`), '')
    if (notes.asks.trim()) L.push('## Asks', '', ...notes.asks.trim().split('\n').map((x) => `- ${x.replace(/^[-•]\s*/, '')}`), '')
    L.push('---', '_Generated with Ledger from payment data._')
    return L.join('\n')
  }, [d, cur, company, notes])

  async function copy(kind: 'md' | 'text') {
    const text = kind === 'md' ? markdown : markdown.replace(/\*\*|__|_|^#+\s|^\|?-{3}.*$/gm, '').replace(/\n{3,}/g, '\n\n')
    await navigator.clipboard.writeText(text)
    setCopied(kind); setTimeout(() => setCopied(''), 2000)
  }
  function download() {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }))
    const a = document.createElement('a'); a.href = url; a.download = `${company.replace(/\W+/g, '-').toLowerCase()}-update-${cur}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!d) return <div className="space-y-6"><ViewHeader kicker="Reporting" title="Investor update" sub="No data in range" /></div>

  return (
    <div className="space-y-6">
      <ViewHeader kicker="Reporting" title="Investor update" sub="A monthly update drafted from your numbers. Add context, then copy it into an email or doc."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cur} onChange={setMonth} options={[...m.months].reverse().map((mo) => ({ value: mo, label: monthName(mo) }))} />
            <button onClick={() => copy('md')} className={BTN}>{copied === 'md' ? '✓ Copied' : 'Copy Markdown'}</button>
            <button onClick={() => copy('text')} className={BTN}>{copied === 'text' ? '✓ Copied' : 'Copy text'}</button>
            <button onClick={download} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-accent-ink shadow-card transition-opacity hover:opacity-90">Download .md</button>
          </div>
        } />

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <div className="no-print space-y-4 lg:sticky lg:top-40">
          <Panel title="Your context" sub="Saved in this browser only">
            <div className="space-y-3">
              <label className="block text-[12.5px] font-medium text-ink-soft">Company name
                <input className={`${TEXTAREA} mt-1 h-9 py-0`} value={notes.company} placeholder={state.workspace.name}
                  onChange={(e) => setNotes({ ...notes, company: e.target.value })} />
              </label>
              <label className="block text-[12.5px] font-medium text-ink-soft">Highlights <span className="font-normal text-ink-faint">— one per line</span>
                <textarea rows={5} className={`${TEXTAREA} mt-1`} value={notes.wins} placeholder={'Shipped SSO\nHired a Head of Sales'}
                  onChange={(e) => setNotes({ ...notes, wins: e.target.value })} />
              </label>
              <label className="block text-[12.5px] font-medium text-ink-soft">Asks <span className="font-normal text-ink-faint">— one per line</span>
                <textarea rows={4} className={`${TEXTAREA} mt-1`} value={notes.asks} placeholder={'Intros to fintech CFOs'}
                  onChange={(e) => setNotes({ ...notes, asks: e.target.value })} />
              </label>
            </div>
          </Panel>
        </div>

        {/* Rendered preview — reads like the email investors will receive */}
        <article className="rounded-2xl border border-line bg-paper px-8 py-9 shadow-card md:px-12">
          <div className="text-[12.5px] font-semibold text-accent">{monthName(cur)}</div>
          <h2 className="mt-1 font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-ink">{company} update</h2>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-soft">
            MRR {d.mrr >= d.pMrr ? 'grew' : 'declined'} to <b className="text-ink">{fmtMoney(d.mrr)}</b> ({pctDelta(rel(d.mrr, d.pMrr))} MoM),
            an annual run-rate of <b className="text-ink">{fmtMoneyShort(d.mrr * 12)}</b>.
          </p>

          <h3 className="mt-8 text-[13px] font-semibold text-ink">Key metrics</h3>
          <table className="mt-2 w-full text-[14px] tabular-nums">
            <thead><tr className="text-left text-[12px] font-medium text-ink-faint">
              <th className="py-2 font-medium">Metric</th><th className="py-2 text-right font-medium">{cur}</th>
              <th className="py-2 text-right font-medium">{d.prev}</th><th className="py-2 text-right font-medium">Δ</th></tr></thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.k} className="border-t border-line">
                  <td className="py-2.5 text-ink-soft">{r.k}</td>
                  <td className="py-2.5 text-right font-semibold text-ink">{r.v}</td>
                  <td className="py-2.5 text-right text-ink-faint">{r.prev || '—'}</td>
                  <td className={`py-2.5 text-right font-medium ${r.good == null || !r.d ? 'text-ink-faint' : r.good ? 'text-pos' : 'text-neg'}`}>{r.d || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {notes.wins.trim() && <Section title="Highlights" items={notes.wins.trim().split('\n').map((x) => x.replace(/^[-•]\s*/, ''))} />}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <EventList title="Revenue wins" items={d.wins} tone="pos" empty="No expansions or new logos this month." />
            <EventList title="Revenue losses" items={d.losses} tone="neg" empty="No churn or downgrades this month." />
          </div>
          {d.auto.length > 0 && <Section title="What the numbers say" items={d.auto} />}
          {notes.asks.trim() && <Section title="Asks" items={notes.asks.trim().split('\n').map((x) => x.replace(/^[-•]\s*/, ''))} />}
          <p className="mt-10 border-t border-line pt-4 text-[12px] text-ink-faint">Generated with Ledger from payment data. Figures reflect the active filters.</p>
        </article>
      </div>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <>
      <h3 className="mt-8 text-[13px] font-semibold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((t, i) => <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-soft"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />{t}</li>)}
      </ul>
    </>
  )
}

function EventList({ title, items, tone, empty }: { title: string; items: { name: string; type: string; amount: number }[]; tone: 'pos' | 'neg'; empty: string }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      {items.length ? (
        <ul className="mt-2 divide-y divide-line">
          {items.map((w, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-[14px]">
              <span className="min-w-0"><span className="block truncate text-ink">{w.name}</span><span className="text-[12px] text-ink-faint">{w.type}</span></span>
              <span className={`shrink-0 font-semibold tabular-nums ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>{signed(w.amount)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-[13.5px] text-ink-faint">{empty}</p>}
    </div>
  )
}
