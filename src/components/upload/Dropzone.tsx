'use client'
import { useState } from 'react'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
import { sampleTransactions } from '@/src/lib/sampleData'
import { useApp } from '@/src/state/AppContext'
import { MappingForm } from './MappingForm'
import { FxForm } from './FxForm'

export function Dropzone() {
  const { state, dispatch } = useApp()
  const [parsed, setParsed] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [currencies, setCurrencies] = useState<string[]>([])
  const [base, setBase] = useState('')
  const [rates, setRates] = useState<FxRates>({})
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

  function analyze() {
    if (!parsed || !mapping) return
    const missing = missingRequired(mapping)
    if (missing.length) { setError(`Map required fields: ${missing.join(', ')}`); return }
    const effectiveRates: FxRates = currencies.length ? { ...rates, [base]: 1 } : {}
    const { transactions, issues } = normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds })
    if (!transactions.length) { setError('No valid rows after normalization — check mapping/FX.'); return }
    dispatch({ type: 'setMapping', mapping }); dispatch({ type: 'setFx', fxRates: effectiveRates })
    dispatch({ type: 'setData', transactions, issues })
  }

  function loadSample() {
    dispatch({ type: 'setData', transactions: sampleTransactions(), issues: [] })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 px-8 py-16">
      <header className="rise">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-display text-xl font-bold text-bone shadow-card">L</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Ledger · Revenue Terminal</div>
        </div>
        <h1 className="mt-5 font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-ink">
          Turn a payments export<br />into a boardroom-ready<br /><span className="text-accent">revenue picture.</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Drop a CSV or Excel of payment rows. Columns auto-detect — confirm the mapping, set FX if multi-currency,
          and MRR, retention, cohorts, movement, concentration and 90+ metrics compute entirely in your browser. Nothing is uploaded.
        </p>
      </header>

      <div className="rise flex flex-col gap-3 sm:flex-row sm:items-stretch" style={{ animationDelay: '60ms' }}>
        <label className="group flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-paper p-8 text-center shadow-card transition-colors hover:border-accent">
          <span className="font-display text-base font-medium text-ink">Choose a .csv / .xlsx file</span>
          <span className="font-mono text-[11px] text-ink-soft">or drag it onto this panel</span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mt-2 block w-full text-xs text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-paper-2 file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-ink hover:file:bg-line-strong" />
        </label>
        <button onClick={loadSample}
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
          <button onClick={analyze} className="rounded-lg bg-accent px-8 py-2.5 font-mono text-sm font-medium uppercase tracking-wider text-bone transition-opacity hover:opacity-90">Analyze →</button>
        </div>
      )}
    </div>
  )
}
