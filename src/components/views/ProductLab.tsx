'use client'
import { useApp } from '@/src/state/AppContext'
import { downloadCsv } from '@/src/lib/csv'
import { DUNNING_TEMPLATE, USAGE_TEMPLATE, DEFERRED_TEMPLATE } from '@/src/lib/engine/productMetrics'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { Callout } from '@/src/components/ui/Callout'

/**
 * Surfaces for metrics that need Stripe webhooks / usage / accounting feeds.
 * Templates + empty states so the product IA is complete.
 */
export function ProductLab() {
  const { dispatch } = useApp()

  return (
    <div className="space-y-4">
      <ViewHeader index="10" kicker="Product & Finance" title="Product · Collections · Deferred"
        sub="Schemas ready — connect Stripe events / usage / ASC 606 feeds to light these up" />

      <Callout tone="neutral">
        These analyses need data beyond payment CSVs. Download templates, or connect Stripe in{' '}
        <button className="underline" onClick={() => dispatch({ type: 'setView', view: 'connectors' })}>Workspace</button>
        {' '}for live subscription MRR (dunning sync is next).
      </Callout>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Dunning & failed payments" sub="recovery rate, failed $">
          <p className="mb-3 text-sm text-ink-soft">
            Tracks invoice payment failures and recoveries. Sourced from Stripe invoices / charge.failed webhooks once wired.
          </p>
          <ul className="mb-4 list-inside list-disc text-[13px] text-ink-soft">
            <li>Failed payment count &amp; $</li>
            <li>Recovery rate (30/60/90d)</li>
            <li>Involuntary churn estimate</li>
          </ul>
          <button onClick={() => downloadCsv('dunning-template', DUNNING_TEMPLATE)}
            className="text-[12.5px] text-side-accent hover:opacity-80 font-medium">
            ↓ Download dunning CSV template
          </button>
        </Panel>

        <Panel title="Seats · usage · adoption" sub="ARPU / seat, activation">
          <p className="mb-3 text-sm text-ink-soft">
            Per-customer seats and active users enable seat ARPU, expansion from seats, and feature-adoption ↔ expansion joins.
          </p>
          <ul className="mb-4 list-inside list-disc text-[13px] text-ink-soft">
            <li>ARPU per seat</li>
            <li>Activation → paid</li>
            <li>Feature adoption vs expansion</li>
            <li>Self-serve vs sales-assist mix</li>
          </ul>
          <button onClick={() => downloadCsv('usage-template', USAGE_TEMPLATE)}
            className="text-[12.5px] text-side-accent hover:opacity-80 font-medium">
            ↓ Download usage CSV template
          </button>
        </Panel>

        <Panel title="Bookings · deferred · GAAP" sub="ASC 606 style">
          <p className="mb-3 text-sm text-ink-soft">
            Contracted bookings vs recognized revenue vs deferred balance. Needs billing/accounting export, not activity MRR alone.
          </p>
          <ul className="mb-4 list-inside list-disc text-[13px] text-ink-soft">
            <li>Booked ARR</li>
            <li>Recognized revenue</li>
            <li>Deferred revenue balance</li>
            <li>Billings vs revenue bridge</li>
          </ul>
          <button onClick={() => downloadCsv('deferred-template', DEFERRED_TEMPLATE)}
            className="text-[12.5px] text-side-accent hover:opacity-80 font-medium">
            ↓ Download deferred CSV template
          </button>
        </Panel>
      </div>

      <Panel title="Also on the roadmap (wired elsewhere partially)">
        <div className="grid gap-3 text-sm text-ink-soft md:grid-cols-2">
          <div>
            <div className="font-medium text-ink">Price rises & discounts</div>
            Needs plan-change event log from Stripe billing portal / quotes.
          </div>
          <div>
            <div className="font-medium text-ink">FX remeasurement</div>
            Needs monthly FX rate history (not single upload-time rates).
          </div>
          <div>
            <div className="font-medium text-ink">Budget vs actual</div>
            Upload a budget MRR series → variance bridge on Forecast.
          </div>
          <div>
            <div className="font-medium text-ink">Quota / ramp</div>
            Extend Pipeline CSV with quota column per owner/month.
          </div>
          <div>
            <div className="font-medium text-ink">NPS / tickets health</div>
            Join CS export to Customer Health score.
          </div>
          <div>
            <div className="font-medium text-ink">Peer percentiles</div>
            Live once ≥5 Trust pages publish in your ARR band (Benchmarks).
          </div>
        </div>
      </Panel>
    </div>
  )
}
