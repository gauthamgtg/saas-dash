'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { parseFile } from '@/src/lib/parse'
import type { ParsedFile } from '@/src/lib/parse'
import { autoDetect, missingRequired } from '@/src/lib/mapping'
import type { Mapping, ColumnField } from '@/src/lib/mapping'
import { detectCurrencies } from '@/src/lib/fx'
import type { FxRates } from '@/src/lib/fx'
import { normalize } from '@/src/lib/normalize'
import type { DateOrder } from '@/src/lib/date'
import { sampleCsvRows } from '@/src/lib/sampleData'
import { downloadCsv } from '@/src/lib/csv'
import { useApp } from '@/src/state/AppContext'
import { MappingForm } from './MappingForm'
import { FxForm } from './FxForm'
import { IssueFixer } from './IssueFixer'
import { Select } from '@/src/components/ui/Select'
import { DropCard } from './DropCard'
import { SiteNav } from '@/src/components/layout/SiteNav'
import { takePendingFile } from '@/src/lib/pendingImport'

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
  const [rowOverrides, setRowOverrides] = useState<Record<number, Record<string, string>>>({})
  const [rowDateOrders, setRowDateOrders] = useState<Record<number, Exclude<DateOrder, 'auto'>>>({})
  const [removedRows, setRemovedRows] = useState<Set<number>>(new Set())
  const [fileName, setFileName] = useState('')

  // a file dropped on the landing page arrives here via client-side navigation
  useEffect(() => { const f = takePendingFile(); if (f) onFile(f) }, [])

  async function onFile(file: File) {
    try {
      setError('')
      const p = await parseFile(file)
      setFileName(file.name)
      const m = autoDetect(p.headers)
      setParsed(p); setMapping(m)
      setRowOverrides({}); setRowDateOrders({}); setRemovedRows(new Set())
      const curCol = m.currency
      const curs = curCol ? detectCurrencies(p.rows.map((r) => r[curCol])) : []
      setCurrencies(curs); setBase(curs[0] ?? '')
      setRates(Object.fromEntries(curs.map((c) => [c, 1])))
    } catch (e) { setError(String(e)) }
  }

  const effectiveRates: FxRates = useMemo(() => (currencies.length ? { ...rates, [base]: 1 } : {}), [currencies, rates, base])
  const missing = mapping ? missingRequired(mapping) : []

  // live validation preview — recomputes as mapping / date-format / FX / row-fixes change
  const preview = useMemo(() => {
    if (!parsed || !mapping || missing.length) return null
    return normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder },
      { overrides: rowOverrides, dateOrders: rowDateOrders, removed: removedRows })
  }, [parsed, mapping, missing.length, effectiveRates, dateOrder, state.controls.includeRefunds, rowOverrides, rowDateOrders, removedRows])

  function handleFix(ids: string[], patch: Partial<Record<ColumnField, string>>, order?: Exclude<DateOrder, 'auto'>) {
    if (!preview || !mapping) return
    const targets = preview.issues.filter((it) => ids.includes(it.id))
    if (Object.keys(patch).length) {
      setRowOverrides((prev) => {
        const next = { ...prev }
        for (const it of targets) {
          const patched = { ...(next[it.rowIndex] ?? {}) }
          for (const [field, value] of Object.entries(patch)) {
            const col = mapping[field as ColumnField]
            if (col) patched[col] = value
          }
          next[it.rowIndex] = patched
        }
        return next
      })
    }
    if (order) {
      setRowDateOrders((prev) => {
        const next = { ...prev }
        targets.forEach((it) => { next[it.rowIndex] = order })
        return next
      })
    }
  }

  function handleRemove(ids: string[]) {
    if (!preview) return
    const targets = preview.issues.filter((it) => ids.includes(it.id))
    setRemovedRows((prev) => new Set([...prev, ...targets.map((it) => it.rowIndex)]))
  }

  function analyze() {
    if (!parsed || !mapping) return
    if (missing.length) { setError(`Map required fields: ${missing.join(', ')}`); return }
    const res = preview ?? normalize(parsed.rows, mapping, effectiveRates, { includeRefunds: state.controls.includeRefunds, dateOrder },
      { overrides: rowOverrides, dateOrders: rowDateOrders, removed: removedRows })
    if (!res.transactions.length) { setError('No valid rows after normalization — check the mapping, date format, and FX rates below.'); return }
    dispatch({ type: 'setMapping', mapping }); dispatch({ type: 'setFx', fxRates: effectiveRates })
    dispatch({ type: 'setData', transactions: res.transactions, issues: res.issues, resolvedDateOrder: res.resolvedDateOrder })
  }

  const valid = preview?.transactions.length ?? 0
  const skipped = preview?.issues.length ?? 0

  const loadSample = () => dispatch({ type: 'loadDemo' })
  const template = () => downloadCsv('mrrmark-sample-template', sampleCsvRows())

  const homeLink = (
    <Link href="/" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-paper px-3 text-[13px] font-medium text-ink-soft shadow-card transition-colors hover:bg-paper-2 hover:text-ink">
      <span aria-hidden>←</span> Home
    </Link>
  )

  if (!parsed || !mapping) {
    return (
      <div className="min-h-screen">
        <SiteNav right={homeLink} />
        <main className="mx-auto max-w-2xl px-6 py-16">
          <div className="rise text-center">
            <div className="text-[13px] font-semibold text-accent">Import</div>
            <h1 className="mt-1 text-[34px] font-semibold tracking-[-0.035em] text-ink">Bring in your payments</h1>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-soft">One row per charge or invoice. Columns auto-detect, and nothing leaves this browser tab.</p>
          </div>
          <div className="rise mt-8" style={{ animationDelay: '60ms' }}><DropCard onFile={onFile} /></div>
          {error && <p role="alert" className="mt-3 rounded-xl border border-neg bg-paper px-4 py-2.5 text-[13px] text-neg shadow-card">{error}</p>}
          <div className="rise mt-6 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '120ms' }}>
            <button onClick={loadSample} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink shadow-card transition-all hover:-translate-y-px hover:shadow-pop">
              Use sample data <span aria-hidden>→</span>
            </button>
            <button onClick={template} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-paper px-4 text-[14px] font-medium text-ink shadow-card transition-colors hover:bg-paper-2">
              Download CSV template
            </button>
          </div>
        </main>
      </div>
    )
  }

  const step = missing.length ? 2 : valid > 0 ? 4 : 3
  const STEPS = ['Upload', 'Map columns', currencies.length > 1 ? 'Currency' : 'Date format', 'Review & analyze']

  return (
    <div className="min-h-screen">
      <SiteNav right={homeLink} />
      <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="rise space-y-6">
        <div>
          <div className="text-[13px] font-semibold text-accent">Import</div>
          <h1 className="mt-1 text-[32px] font-semibold tracking-[-0.035em] text-ink">Set up your data</h1>
          <p className="mt-1.5 text-[15px] text-ink-soft">Confirm how your columns map, then analyze. Everything stays in this browser tab.</p>
        </div>
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((t, i) => {
            const n = i + 1, done = n < step, on = n === step
            return (
              <li key={t} className="flex items-center gap-2">
                <span className={`flex h-8 items-center gap-2 rounded-full border pl-1 pr-3 text-[13px] font-medium ${on ? 'border-accent bg-navy text-accent' : done ? 'border-line bg-paper text-ink' : 'border-line bg-paper text-ink-faint'}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[11.5px] font-semibold ${done || on ? 'bg-accent text-accent-ink' : 'bg-paper-2 text-ink-faint'}`}>{done ? '✓' : n}</span>
                  {t}
                </span>
                {n < STEPS.length && <span className="h-px w-4 bg-line-strong" />}
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-paper p-4 shadow-card">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-[12.5px] font-semibold text-accent">{fileName.split('.').pop()}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold text-ink">{fileName}</div>
            <div className="text-[13px] text-ink-soft">{parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns detected</div>
          </div>
          <div className="w-full sm:w-64"><DropCard onFile={onFile} compact /></div>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-neg bg-paper px-4 py-2.5 text-sm text-neg shadow-card">{error}</p>}

      {parsed && mapping && (
        <div className="space-y-8">
          <section><h2 className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-ink">Map columns</h2>
            <MappingForm headers={parsed.headers} mapping={mapping} onChange={setMapping} /></section>

          {currencies.length > 1 && (
            <section><h2 className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-ink">Currency conversion</h2>
              <FxForm currencies={currencies} base={base} rates={rates} onBase={setBase}
                onRate={(c, r) => setRates((x) => ({ ...x, [c]: r }))} /></section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Review & analyze</h2>
              <label className="flex items-center gap-2 text-sm"><span className="text-[13px] font-medium text-ink-soft">Date format</span>
                <Select value={dateOrder} onChange={(v) => setDateOrder(v as DateOrder)} options={DATE_OPTS.map((o) => ({ value: o.v, label: o.label }))} />
              </label>
            </div>

            {missing.length > 0 ? (
              <p className="rounded-lg border border-warn/40 border-l-2 border-l-warn bg-paper px-3 py-2 text-sm text-warn">Map the required fields first: {missing.join(', ')}</p>
            ) : preview && (
              <>
                <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card [&>*]:border-0">
                  <div className="bg-paper p-4"><div className="text-[12.5px] font-medium text-ink-soft">Valid rows</div><div className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em] text-pos">{valid.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="text-[12.5px] font-medium text-ink-soft">Skipped</div><div className={`mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em] ${skipped ? 'text-warn' : 'text-ink'}`}>{skipped.toLocaleString()}</div></div>
                  <div className="bg-paper p-4"><div className="text-[12.5px] font-medium text-ink-soft">Date order</div><div className="mt-1.5 text-[14px] font-medium text-ink">{dateOrder === 'auto' ? `auto → ${ORDER_NAME[preview.resolvedDateOrder]}` : ORDER_NAME[preview.resolvedDateOrder]}</div></div>
                </div>
                {skipped > 0 && (
                  <>
                    <p className="text-[11px] text-ink-soft">{skipped.toLocaleString()} of {preview.total.toLocaleString()} rows can’t be used. Fix them below, or proceed with the {valid.toLocaleString()} valid rows.</p>
                    <IssueFixer issues={preview.issues} mapping={mapping} onFix={handleFix} onRemove={handleRemove} />
                  </>
                )}
              </>
            )}

            <button onClick={analyze} disabled={!preview || valid === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-6 text-[14.5px] font-semibold text-accent-ink shadow-card transition-all hover:-translate-y-px hover:shadow-pop disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0">
              Analyze {valid > 0 ? `${valid.toLocaleString()} rows` : ''} <span aria-hidden>→</span>
            </button>
          </section>
        </div>
      )}
      </div>
    </div>
  )
}
