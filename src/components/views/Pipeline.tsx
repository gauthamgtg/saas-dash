'use client'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { parseFile } from '@/src/lib/parse'
import { downloadCsv } from '@/src/lib/csv'
import { parsePipelineRows, summarizePipeline, PIPELINE_TEMPLATE, PIPELINE_STAGES } from '@/src/lib/pipeline'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct, fmtNum } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-5 [&>*]:border-0'

function PipelineUploader({ replace }: { replace?: boolean }) {
  const { dispatch } = useApp()
  const [errors, setErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File) {
    try {
      const { rows, errors } = parsePipelineRows(await parseFile(file))
      if (rows.length) dispatch({ type: 'setPipeline', pipeline: rows })
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
          {replace ? 'Replace pipeline CSV' : 'Upload pipeline CSV'}
        </button>
        <button onClick={() => downloadCsv('pipeline-template', PIPELINE_TEMPLATE)}
          className="text-[12.5px] text-side-accent hover:opacity-80 font-medium">
          ↓ Download template
        </button>
        {replace && (
          <button onClick={() => dispatch({ type: 'setPipeline', pipeline: null })}
            className="text-[12.5px] text-ink-faint hover:text-neg font-medium">
            Clear
          </button>
        )}
      </div>
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-neg tabular-nums">
          {errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </div>
  )
}

export function Pipeline() {
  const { state } = useApp()
  const deals = state.pipeline
  const summary = useMemo(() => (deals?.length ? summarizePipeline(deals) : null), [deals])

  if (!deals?.length || !summary) {
    return (
      <div className="space-y-4">
        <ViewHeader index="04" kicker="Go-to-market" title="Pipeline"
          sub="CRM opportunity CSV — win rate, weighted pipeline, and owner coverage" />
        <Panel title="Upload opportunities">
          <p className="mb-4 text-sm text-ink-soft">
            Bridge bookings foresight with closed revenue. Export opportunities from HubSpot / Salesforce / Attio with stage, amount, and expected close date.
          </p>
          <PipelineUploader />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                  <th className="py-2 pr-4">Column</th><th className="py-2 pr-4">Required</th><th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="text-ink-soft">
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">deal_id / name</td><td className="py-2 pr-4">one of</td><td className="py-2">Opportunity identifier or account name</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">stage</td><td className="py-2 pr-4">yes</td><td className="py-2">{PIPELINE_STAGES.join(' · ')}</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">amount</td><td className="py-2 pr-4">yes</td><td className="py-2">Expected ACV / booking in base currency</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">close_date</td><td className="py-2 pr-4">yes</td><td className="py-2">YYYY-MM or full date</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">owner</td><td className="py-2 pr-4">no</td><td className="py-2">AE / owner for leaderboard</td></tr>
                <tr className="border-b border-line"><td className="py-2 pr-4 tabular-nums">source</td><td className="py-2 pr-4">no</td><td className="py-2">Inbound, outbound, partner…</td></tr>
                <tr><td className="py-2 pr-4 tabular-nums">probability</td><td className="py-2 pr-4">no</td><td className="py-2">0–1 or %; defaults by stage if omitted</td></tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    )
  }

  const stageBars = summary.byStage.map((s) => ({ stage: s.stage, Amount: Math.round(s.amount) }))
  const monthBars = summary.byMonth.map((m) => ({ month: m.month, Weighted: Math.round(m.weighted), Won: Math.round(m.won) }))

  return (
    <div className="space-y-4">
      <ViewHeader index="04" kicker="Go-to-market" title="Pipeline"
        sub={`${fmtNum(deals.length)} opportunities · weighted open ${fmtMoneyShort(summary.weightedPipeline)}`}
        actions={<PipelineUploader replace />} />

      <div className={KSTRIP}>
        <KpiCard label="Open pipeline" value={fmtMoneyShort(summary.openAmount)} hint={`${summary.openCount} deals`} />
        <KpiCard label="Weighted" value={fmtMoneyShort(summary.weightedPipeline)} hint="× probability" />
        <KpiCard label="Won (period)" value={fmtMoneyShort(summary.wonAmount)} tone="pos" />
        <KpiCard label="Lost" value={fmtMoneyShort(summary.lostAmount)} tone="neg" />
        <KpiCard label="Win rate" value={fmtPct(summary.winRate)} hint="won ÷ closed" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="By stage" sub="gross opportunity amount">
          <BarsChart data={stageBars} xKey="stage" height={280} series={[{ key: 'Amount', color: CHART.accent }]} />
        </Panel>
        <Panel title="Close calendar" sub="weighted open vs won by expected close month">
          <BarsChart data={monthBars} xKey="month" height={280} series={[
            { key: 'Weighted', color: CHART.steel },
            { key: 'Won', color: CHART.pos },
          ]} />
        </Panel>
      </div>

      <Panel title="Owner coverage">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Open</th>
                <th className="py-2 pr-4">Weighted</th>
                <th className="py-2">Won</th>
              </tr>
            </thead>
            <tbody>
              {summary.byOwner.map((o) => (
                <tr key={o.owner} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-medium">{o.owner}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(o.open)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(o.weighted)}</td>
                  <td className="py-2 tabular-nums text-pos">{fmtMoney(o.won)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Open deals">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[12px] text-ink-faint font-medium">
                <th className="py-2 pr-4">Deal</th><th className="py-2 pr-4">Stage</th><th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Weighted</th><th className="py-2 pr-4">Close</th>
                <th className="py-2 pr-4">Owner</th><th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').sort((a, b) => b.amount * b.probability - a.amount * a.probability).map((d) => (
                <tr key={d.dealId} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-medium">{d.name}</td>
                  <td className="py-2 pr-4 text-[12.5px] font-medium">{d.stage}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(d.amount)}</td>
                  <td className="py-2 pr-4 tabular-nums">{fmtMoney(d.amount * d.probability)}</td>
                  <td className="py-2 pr-4 tabular-nums">{d.closeMonth}</td>
                  <td className="py-2 pr-4">{d.owner}</td>
                  <td className="py-2 text-ink-soft">{d.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
