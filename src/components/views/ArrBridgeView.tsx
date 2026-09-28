'use client'
import { useMemo } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import {
  buildMatrix, movementSeries, arrBridge, arrBridgeHistory, diligencePack, recurringSplit,
} from '@/src/lib/engine'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { KpiCard } from '@/src/components/ui/KpiCard'
import { Panel } from '@/src/components/ui/Panel'
import { Waterfall } from '@/src/components/ui/Waterfall'
import { BarsChart } from '@/src/components/ui/BarsChart'
import { CHART } from '@/src/lib/theme'
import { fmtMoney, fmtMoneyShort, fmtPct } from '@/src/lib/format'

const KSTRIP = 'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-card md:grid-cols-5 [&>*]:border-0'
const ROW = 'flex items-center justify-between border-b border-line py-2 text-sm last:border-0'

export function ArrBridgeView() {
  const { state } = useApp()
  const txs = useMemo(() => applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds), [state.transactions, state.filters, state.range, state.controls.includeRefunds])
  const m = useMemo(() => buildMatrix(txs, state.controls.mode), [txs, state.controls.mode])
  const series = useMemo(() => movementSeries(m, { reactivationGapK: state.controls.reactivationGapK }), [m, state.controls.reactivationGapK])

  const d = useMemo(() => {
    if (!m.months.length) return null
    const bridge = arrBridge(m, series)
    const hist = arrBridgeHistory(m, series)
    const pack = diligencePack(m, series)
    const split = recurringSplit(txs)
    const chart = hist.slice(-18).map((r) => ({
      month: r.month,
      New: Math.round(r.newMrr),
      Expansion: Math.round(r.expansion),
      Reactivation: Math.round(r.reactivation),
      Contraction: -Math.round(r.contraction),
      Churn: -Math.round(r.churn),
    }))
    return { bridge, hist, pack, split, chart }
  }, [m, series, txs])

  if (!d?.bridge) {
    return (
      <div className="space-y-4">
        <ViewHeader index="01" kicker="Board" title="ARR Bridge" />
        <Panel><p className="text-sm text-ink-faint tabular-nums">Need ≥2 months.</p></Panel>
      </div>
    )
  }

  const b = d.bridge
  return (
    <div className="space-y-4">
      <ViewHeader index="01" kicker="Board / Diligence" title="ARR Bridge"
        sub={`${b.periodStart} → ${b.periodEnd} · print-ready investor bridge`}
        actions={<button onClick={() => window.print()} className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2 font-medium">⤓ Print</button>}
      />

      <div className={KSTRIP}>
        <KpiCard label="Opening ARR" value={fmtMoneyShort(b.openingArr)} />
        <KpiCard label="Closing ARR" value={fmtMoneyShort(b.closingArr)} />
        <KpiCard label="Net new MRR" value={fmtMoney(b.netNew)} tone={b.netNew >= 0 ? 'pos' : 'neg'} />
        <KpiCard label="NRR" value={fmtPct(b.nrr)} />
        <KpiCard label="YoY" value={fmtPct(b.yoy)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRR bridge waterfall">
          <Waterfall opening={b.openingMrr} newMrr={b.newMrr} expansion={b.expansion} reactivation={b.reactivation}
            contraction={b.contraction} churn={b.churn} height={300} />
        </Panel>
        <Panel title="Bridge detail">
          <div className="space-y-0">
            <div className={ROW}><span>Opening MRR</span><span className="tabular-nums">{fmtMoney(b.openingMrr)}</span></div>
            <div className={ROW}><span className="text-pos">+ New</span><span className="text-pos tabular-nums">{fmtMoney(b.newMrr)}</span></div>
            <div className={ROW}><span className="text-pos">+ Expansion</span><span className="text-pos tabular-nums">{fmtMoney(b.expansion)}</span></div>
            <div className={ROW}><span className="text-pos">+ Reactivation</span><span className="text-pos tabular-nums">{fmtMoney(b.reactivation)}</span></div>
            <div className={ROW}><span className="text-warn">− Contraction</span><span className="text-warn tabular-nums">{fmtMoney(b.contraction)}</span></div>
            <div className={ROW}><span className="text-neg">− Churn</span><span className="text-neg tabular-nums">{fmtMoney(b.churn)}</span></div>
            <div className={`${ROW} font-medium`}><span>Closing MRR</span><span className="tabular-nums">{fmtMoney(b.closingMrr)}</span></div>
            <div className={ROW}><span>Logo churn</span><span className="tabular-nums">{fmtPct(b.logoChurn)}</span></div>
            <div className={ROW}><span>Rev-weighted churn</span><span className="tabular-nums">{fmtPct(b.rwChurn)}</span></div>
            <div className={ROW}><span>GRR</span><span className="tabular-nums">{fmtPct(b.grr)}</span></div>
          </div>
        </Panel>
      </div>

      <Panel title="Historical bridge components">
        <BarsChart data={d.chart} xKey="month" stacked height={300} series={[
          { key: 'New', color: CHART.pos },
          { key: 'Expansion', color: CHART.accent },
          { key: 'Reactivation', color: CHART.violet },
          { key: 'Contraction', color: CHART.warn },
          { key: 'Churn', color: CHART.neg },
        ]} />
      </Panel>

      <Panel title="Recurring vs one-time proxy" sub="from business model / plan labels">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-line p-3">
            <div className="text-[12px] text-ink-faint font-medium">Recurring</div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{fmtMoneyShort(d.split.recurring)}</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[12px] text-ink-faint font-medium">One-time</div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{fmtMoneyShort(d.split.oneTime)}</div>
          </div>
          <div className="rounded-lg border border-line p-3">
            <div className="text-[12px] text-ink-faint font-medium">Recurring share</div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em]">{fmtPct(d.split.recurringShare)}</div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
