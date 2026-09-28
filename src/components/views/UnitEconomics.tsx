'use client'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, arpa, grr, ltvRevenue, cacSeries, blendedCac, cacPaybackMonths, magicNumber, ruleOf40, spendByMonth, burnMultiple, avgMonthlyNetBurn, runwayMonths } from '@/src/lib/engine'
import { Panel } from '@/src/components/ui/Panel'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { TrendChart } from '@/src/components/ui/TrendChart'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { fmtMoney, fmtPct } from '@/src/lib/format'
import { downloadCsv } from '@/src/lib/csv'
import { parseFile } from '@/src/lib/parse'
import { parseSpendRows, SPEND_TEMPLATE } from '@/src/lib/spend'

/** Average a monthly (start,end) metric over up to the last 12 month-pairs. */
function trailingAvg(months: string[], f: (start: string, end: string) => number | null): number | null {
  const vals: number[] = []
  for (let i = Math.max(1, months.length - 12); i < months.length; i++) {
    const v = f(months[i - 1], months[i])
    if (v != null) vals.push(v)
  }
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

function SpendUploader({ replace }: { replace?: boolean }) {
  const { dispatch } = useApp()
  const [errors, setErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    try {
      const { rows, errors } = parseSpendRows(await parseFile(file))
      if (rows.length) dispatch({ type: 'setSpend', spend: rows })
      setErrors(rows.length ? errors : errors.length ? errors : ['No usable rows found.'])
    } catch {
      setErrors(['Could not read file. Upload a .csv, .xlsx or .xls file.'])
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => inputRef.current?.click()}
          className="rounded-md bg-side-accent px-4 py-2 text-[13px] font-medium text-white shadow-card transition-opacity hover:opacity-90">
          {replace ? 'Replace spend data' : 'Upload spend CSV'}
        </button>
        <button onClick={() => downloadCsv('marketing-spend-template', SPEND_TEMPLATE)}
          className="text-[12.5px] text-side-accent transition-opacity hover:opacity-80 font-medium">
          ↓ Download template
        </button>
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-neg tabular-nums">
          {errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
          {errors.length > 8 && <li>…and {errors.length - 8} more</li>}
        </ul>
      )}
    </div>
  )
}

function FormatDoc() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
            <th className="py-2 pr-4">Column</th><th className="py-2 pr-4">Required</th><th className="py-2">Notes</th>
          </tr>
        </thead>
        <tbody className="text-ink-soft">
          <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">month</td><td className="py-2 pr-4">yes</td><td className="py-2">YYYY-MM (a full date also works — truncated to month)</td></tr>
          <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">amount</td><td className="py-2 pr-4">yes</td><td className="py-2">spend in your base currency; "$1,200" ok</td></tr>
          <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">channel</td><td className="py-2 pr-4">no</td><td className="py-2">e.g. Google Ads, Meta, Content — used for the breakdown chart</td></tr>
          <tr><td className="py-2 pr-4 tabular-nums">category</td><td className="py-2 pr-4">no</td><td className="py-2"><span className="tabular-nums">marketing</span> (default) · <span className="tabular-nums">sales</span> · <span className="tabular-nums">other</span>. CAC uses marketing+sales; add <span className="tabular-nums">other</span> rows (payroll, infra) to make Rule of 40 real</td></tr>
        </tbody>
      </table>
    </div>
  )
}

export function UnitEconomics() {
  const { state, dispatch } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const spend = state.spend

  const model = useMemo(() => {
    if (!spend || !m.months.length) return null
    const series = cacSeries(m, spend)
    const cac = blendedCac(series)
    const last = m.months[m.months.length - 1]
    const arpaNow = arpa(m, last)
    const gm = state.controls.grossMargin
    const churn = trailingAvg(m.months, (s, e) => { const r = grr(m, s, e); return r == null ? null : 1 - r })
    const ltv = arpaNow != null && churn != null ? ltvRevenue(arpaNow, gm, churn) : null
    const byChannel = [...spend.reduce((acc, r) => acc.set(r.channel, (acc.get(r.channel) ?? 0) + r.amount), new Map<string, number>())]
      .map(([channel, amount]) => ({ channel, amount })).sort((a, b) => b.amount - a.amount)
    const revByMonth = new Map(m.months.map((mo) => [mo, m.customers.reduce((s, c) => s + (m.cells.get(c)?.get(mo) ?? 0), 0)]))
    const allSpend = spendByMonth(spend)
    const spendVsRev = [...allSpend.keys()].sort().map((mo) => ({ month: mo, spend: allSpend.get(mo) ?? 0, revenue: revByMonth.get(mo) ?? 0 }))
    const burn = burnMultiple(m, spend)
    const netBurn = avgMonthlyNetBurn(m, spend)
    const runway = state.cashOnHand != null && netBurn != null ? runwayMonths(state.cashOnHand, netBurn) : null
    return {
      series, cac, ltv,
      ltvToCac: ltv != null && cac != null && cac > 0 ? ltv / cac : null,
      payback: cac != null && arpaNow != null ? cacPaybackMonths(cac, arpaNow, gm) : null,
      magic: magicNumber(m, spend),
      r40: ruleOf40(m, spend),
      burn, netBurn, runway,
      byChannel, spendVsRev,
    }
  }, [m, spend, state.controls.grossMargin, state.cashOnHand])

  if (!spend) {
    return (
      <>
        <ViewHeader index="09" kicker="Efficiency" title="Unit Economics"
          sub="CAC, LTV:CAC, payback, burn multiple and Rule of 40 — needs your spend data" />
        <Panel title="Upload marketing, sales & opex spend" sub="One row per month per channel. Use category other for payroll/infra so Rule of 40 and burn are real.">
          <div className="space-y-5">
            <FormatDoc />
            <SpendUploader />
          </div>
        </Panel>
      </>
    )
  }

  if (!model) return <p className="py-12 text-center text-xs text-ink-faint tabular-nums">No data in range</p>

  const hasOther = spend.some((r) => r.category === 'other')
  return (
    <>
      <ViewHeader index="09" kicker="Efficiency" title="Unit Economics"
        sub={`${spend.length} spend rows · ${new Set(spend.map((r) => r.month)).size} months · gross margin ${fmtPct(state.controls.grossMargin)} (Control bar → Assumptions)`}
        actions={<SpendUploader replace />} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Blended CAC" value={model.cac != null ? fmtMoney(model.cac) : '—'} hint="S&M spend / new customers, trailing 3 reported months" hero />
        <KpiCard label="LTV : CAC" value={model.ltvToCac != null ? `${model.ltvToCac.toFixed(1)}×` : '—'}
          tone={model.ltvToCac == null ? 'default' : model.ltvToCac >= 3 ? 'pos' : 'neg'} hint="target ≥ 3×" />
        <KpiCard label="CAC payback" value={model.payback != null ? `${model.payback.toFixed(1)} mo` : '—'}
          tone={model.payback == null ? 'default' : model.payback <= 12 ? 'pos' : 'neg'} hint="months of gross profit to recover CAC · target ≤ 12" />
        <KpiCard label="Magic number" value={model.magic != null ? model.magic.toFixed(2) : '—'}
          tone={model.magic == null ? 'default' : model.magic >= 0.75 ? 'pos' : 'neg'} hint="net new ARR / prior-quarter S&M · ≥ 0.75 = efficient" />
        <KpiCard label="Rule of 40" value={model.r40 ? fmtPct(model.r40.score) : '—'}
          tone={!model.r40 ? 'default' : model.r40.score >= 0.4 ? 'pos' : 'neg'}
          hint={model.r40 ? `${fmtPct(model.r40.growth)} growth + ${fmtPct(model.r40.margin)} margin${hasOther ? '' : ' · add category "other" costs for a real margin'}` : 'needs 12+ months of history'} />
        <KpiCard label="Burn multiple" value={model.burn == null ? '—' : !Number.isFinite(model.burn) ? '∞' : `${model.burn.toFixed(1)}×`}
          tone={model.burn == null || !Number.isFinite(model.burn) ? 'default' : model.burn <= 1.5 ? 'pos' : model.burn <= 2 ? 'default' : 'neg'}
          hint="net burn ÷ net new ARR · lower is better" />
      </div>

      <Panel title="Cash & runway proxy">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-faint font-medium">Cash on hand</span>
            <input type="number" className="w-36 rounded border border-line-strong bg-paper px-2 py-1.5 text-[13px] tabular-nums outline-none focus:border-accent"
              placeholder="optional" value={state.cashOnHand ?? ''}
              onChange={(e) => dispatch({ type: 'setCashOnHand', cashOnHand: e.target.value === '' ? null : Number(e.target.value) })} />
          </label>
          <div className="text-sm text-ink-soft">
            Avg net burn / mo: <span className="tabular-nums text-ink">{fmtMoney(model.netBurn)}</span>
            {' · '}
            Runway: <span className="tabular-nums text-ink">
              {model.runway == null ? '—' : !Number.isFinite(model.runway) ? '∞' : `${model.runway.toFixed(0)} mo`}
            </span>
          </div>
        </div>
        {!hasOther && (
          <p className="mt-3 text-[11px] text-warn tabular-nums">Tip: include category &quot;other&quot; rows (payroll, infra) so burn and Rule of 40 use a full cost base.</p>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="CAC by month" sub="S&M spend / new customers acquired"
          csv={{ filename: 'cac-by-month', rows: model.series }}>
          <TrendChart data={model.series} xKey="month"
            series={[{ key: 'cac', name: 'CAC', color: 'var(--accent)' }]} height={260} />
        </Panel>
        <Panel title="Spend vs revenue" sub="all uploaded spend against monthly revenue"
          csv={{ filename: 'spend-vs-revenue', rows: model.spendVsRev }}>
          <TrendChart data={model.spendVsRev} xKey="month" area
            series={[{ key: 'revenue', name: 'Revenue', color: 'var(--pos)' }, { key: 'spend', name: 'Spend', color: 'var(--neg)' }]} height={260} />
        </Panel>
      </div>

      <Panel title="Spend by channel" sub="total across uploaded months"
        csv={{ filename: 'spend-by-channel', rows: model.byChannel }}>
        <BarsChart data={model.byChannel.slice(0, 12)} xKey="channel" horizontal
          series={[{ key: 'amount', name: 'Spend', color: 'var(--accent)' }]}
          height={Math.max(160, Math.min(model.byChannel.length, 12) * 36)} />
      </Panel>
    </>
  )
}
