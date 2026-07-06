'use client'
import { useMemo, useState } from 'react'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
import type { DateOrder } from '@/src/lib/date'
import { sampleTransactions } from '@/src/lib/sampleData'
import { useApp } from '@/src/state/AppContext'
import { MappingForm } from './MappingForm'
import { FxForm } from './FxForm'
import { IssueSummary } from './IssueSummary'

const DATE_OPTS: { v: DateOrder; label: string }[] = [
  { v: 'auto', label: 'Auto-detect' }, { v: 'dmy', label: 'Day first · DD/MM/YYYY' },
  { v: 'mdy', label: 'Month first · MM/DD/YYYY' }, { v: 'ymd', label: 'Year first · YYYY-MM-DD' },
]
const ORDER_NAME: Record<string, string> = { dmy: 'day-first (DD/MM/YYYY)', mdy: 'month-first (MM/DD/YYYY)', ymd: 'year-first (YYYY-MM-DD)' }

export function Dropzone() {
  const { state, dispatch } = useApp()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [base, setBase] = useState('')
  const [rates, setRates] = useState<FxRates>({})
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto')
  const [error, setError] = useState('')

  async function onFile(file: File) {
    try {
      setError('')
      const p = await parseFile(file)
      const m = autoDetect(p.headers)
      setParsed(p); setMapping(m)
      const curCol = m.currency
      const curs = curCol ? detectCurrencies(p.rows.map((r) => r[curCol])) : []
      setCurrencies(curs); setBase(curs[0] ?? '')
      setRates(Object.fromEntries(curs.map((c) => [c, 1])))
    } catch (e) { setError(String(e)) }
  }

  const effectiveRates: FxRates = useMemo(() => (currencies.length ? { ...rates, [base]: 1 } : {}), [currencies, rates, base])
  const missing = mapping ? missingRequired(mapping) : []

  // live validation preview — recomputes as mapping / date-format / FX change
  const preview = useMemo(() => {
    if (!parsed || !mapping || missing.length) return null
    return normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder })
  }, [parsed, mapping, missing.length, effectiveRates, dateOrder, state.controls.includeRefunds])

  function analyze() {
    if (!parsed || !mapping) return
    if (missing.length) { setError(`Map required fields: ${missing.join(', ')}`); return }
    const res = preview ?? normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder })
    if (!res.transactions.length) { setError('No valid rows after normalization — check the mapping, date format, and FX rates below.'); return }
    dispatch({ type: 'setMapping', mapping }); dispatch({ type: 'setFx', fxRates: effectiveRates })
    dispatch({ type: 'setData', transactions: res.transactions, issues: res.issues })
  }

  const valid = preview?.transactions.length ?? 0
  const skipped = preview?.issues.length ?? 0

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-8 py-16">
      <header className="rise">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-display text-xl font-bold text-accent-ink shadow-card">L</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Ledger · Revenue Terminal</div>
        </div>
        <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-ink">
          Turn a payments export<br />into a boardroom-ready<br /><span className="text-accent">revenue picture.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Drop a CSV or Excel of payment rows. Columns auto-detect — confirm the mapping, set FX if multi-currency,
          and 100+ metrics compute entirely in your browser. Nothing is uploaded.
        </p>
      </header>

      <div className="rise flex flex-col gap-3 sm:flex-row sm:items-stretch" style={{ animationDelay: '60ms' }}>
        <label className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-paper p-8 text-center shadow-card transition-colors hover:border-accent">
          <span className="font-display text-base font-medium text-ink">Choose a .csv / .xlsx file</span>
          <span className="font-mono text-[11px] text-ink-soft">or drag it onto this panel</span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-ink hover:file:bg-line-strong" />
        </label>
        <button onClick={() => dispatch({ type: 'setData', transactions: sampleTransactions(), issues: [] })}
          className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line bg-paper-2 px-7 py-6 text-center shadow-card transition-colors hover:border-accent">
          <span className="font-display text-base font-medium text-ink">Try sample data</span>
          <span className="font-mono text-[11px] text-ink-soft">18 months · 52 accounts →</span>
        </button>
      </div>

      {error && <p className="rounded-lg border border-neg/40 border-l-2 border-l-neg bg-paper px-3 py-2 text-sm text-neg">{error}</p>}

      {parsed && mapping && (
        <div className="space-y-8">
          <section><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Map columns</h2>
            <MappingForm headers={parsed.headers} mapping={mapping} onChange={setMapping} /></section>

          {currencies.length > 1 && (
            <section><h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Currency conversion</h2>
              <FxForm currencies={currencies} base={base} rates={rates} onBase={setBase}
                onRate={(c, r) => setRates((x) => ({ ...x, [c]: r }))} /></section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">Validate</h2>
              <label className="flex items-center gap-2 text-sm"><span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date format</span>
                <select className="rounded-md px-2 py-1 text-sm" value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                  {DATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </label>
            </div>

            {missing.length > 0 ? (
              <p className="rounded-lg border border-warn/40 border-l-2 border-l-warn bg-paper px-3 py-2 text-sm text-warn">Map the required fields first: {missing.join(', ')}</p>
            ) : preview && (
              <>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line [&>*]:border-0">
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Valid rows</div><div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-pos">{valid.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Skipped</div><div className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${skipped ? 'text-warn' : 'text-ink'}`}>{skipped.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Date order</div><div className="mt-1 font-mono text-sm tabular-nums text-ink">{dateOrder === 'auto' ? `auto → ${ORDER_NAME[preview.resolvedDateOrder]}` : ORDER_NAME[preview.resolvedDateOrder]}</div></div>
                </div>
                {skipped > 0 && (
                  <>
                    <p className="text-[11px] text-ink-soft">{skipped.toLocaleString()} of {preview.total.toLocaleString()} rows can’t be used. Fix the mapping or date format to recover them — or proceed with the {valid.toLocaleString()} valid rows.</p>
                    <IssueSummary issues={preview.issues} />
                  </>
                )}
              </>
            )}

            <button onClick={analyze} disabled={!preview || valid === 0}
              className="rounded-lg bg-accent px-8 py-2.5 font-mono text-sm font-medium uppercase tracking-wider text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
              Analyze {valid > 0 ? `${valid.toLocaleString()} rows ` : ''}→
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
