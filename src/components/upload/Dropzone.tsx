'use client'
import { useState } from 'react'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <h1 className="text-2xl font-bold">Upload revenue data</h1>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        className="block w-full rounded border-2 border-dashed border-slate-300 p-8 text-center" />
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {parsed && mapping && (
        <>
          <section><h2 className="mb-2 font-semibold">Map columns</h2>
            <MappingForm headers={parsed.headers} mapping={mapping} onChange={setMapping} /></section>
          {currencies.length > 1 && (
            <section><h2 className="mb-2 font-semibold">Currency conversion</h2>
              <FxForm currencies={currencies} base={base} rates={rates} onBase={setBase}
                onRate={(c, r) => setRates((x) => ({ ...x, [c]: r }))} /></section>
          )}
          <button onClick={analyze} className="rounded bg-indigo-600 px-6 py-2 font-semibold text-white hover:bg-indigo-700">Analyze</button>
        </>
      )}
    </div>
  )
}
