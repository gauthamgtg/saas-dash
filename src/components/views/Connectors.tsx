'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/src/state/AppContext'
import { applyFilters } from '@/src/lib/dashboard'
import { buildMatrix, mrrOf, arr as arrOf, activeCustomers, cmgr, nrr, logoChurnRate, quickRatio, movementSeries } from '@/src/lib/engine'
import { addMonths } from '@/src/lib/types'
import { ViewHeader } from '@/src/components/ui/ViewHeader'
import { Panel } from '@/src/components/ui/Panel'
import { Callout } from '@/src/components/ui/Callout'
import { cloud, getCloudToken, setCloudToken } from '@/src/lib/cloud'
import { fmtMoney, fmtMoneyShort, fmtNum } from '@/src/lib/format'
import { sparklineFromSeries } from '@/src/lib/sparkline'

const ROLES = [
  { v: 'founder' as const, label: 'Founder / operator' },
  { v: 'analyst' as const, label: 'Data analyst' },
  { v: 'investor' as const, label: 'Investor' },
  { v: 'advisor' as const, label: 'Advisor / board' },
]

type Me = Awaited<ReturnType<typeof cloud.me>>

export function Connectors() {
  const { state, dispatch } = useApp()
  const [me, setMe] = useState<Me | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [stripeKey, setStripeKey] = useState('')
  const [trustSlug, setTrustSlug] = useState('')
  const [trustPublic, setTrustPublic] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  const localMetrics = useMemo(() => {
    const txs = applyFilters(state.transactions ?? [], state.filters, state.range, state.controls.includeRefunds)
    const m = buildMatrix(txs, state.controls.mode)
    if (!m.months.length) return null
    const last = m.months[m.months.length - 1]
    const prev = m.months.length > 1 ? m.months[m.months.length - 2] : addMonths(last, -1)
    const series = m.months.map((mo) => ({ month: mo, mrr: mrrOf(m, mo) }))
    const move = movementSeries(m, { reactivationGapK: state.controls.reactivationGapK })
    return {
      mrr: mrrOf(m, last),
      arr: arrOf(m, last),
      customers: activeCustomers(m, last),
      sparkline: sparklineFromSeries(series),
      growth: cmgr(m),
      nrr: nrr(m, prev, last),
      logoChurn: logoChurnRate(m, prev, last),
      quick: quickRatio(move.slice(-3)),
      month: last,
    }
  }, [state.transactions, state.filters, state.range, state.controls])

  async function refresh() {
    if (!getCloudToken()) { setMe(null); return }
    try {
      const data = await cloud.me()
      setMe(data)
      if (data.trust?.publicSlug) setTrustSlug(data.trust.publicSlug)
      dispatch({
        type: 'setConnectors',
        connectors: data.stripe
          ? { stripe: data.stripe.status === 'connected' ? 'connected' : 'error', stripeEmail: data.stripe.accountEmail, lastSyncAt: data.stripe.lastSyncAt, mode: data.stripe.mode === 'oauth' ? 'stripe-oauth' : 'stripe-key' }
          : { stripe: 'disconnected', stripeEmail: null, lastSyncAt: null, mode: 'csv' },
      })
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Failed to load workspace')
      if (String(e).includes('401') || String(e).includes('Invalid')) setCloudToken(null)
    }
  }

  useEffect(() => { refresh() }, [])

  async function createWs() {
    setBusy(true); setErrMsg(''); setMsg('')
    try {
      const res = await cloud.createWorkspace({
        name: state.workspace.name || 'My company',
        role: state.workspace.role,
      })
      setCloudToken(res.accessToken)
      setMsg(`Workspace created (${res.storage}). Token saved in this browser.`)
      await refresh()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Create failed')
    } finally { setBusy(false) }
  }

  async function connectKey() {
    setBusy(true); setErrMsg(''); setMsg('')
    try {
      const res = await cloud.connectStripeKey(stripeKey.trim())
      setStripeKey('')
      setMsg(`Stripe connected · MRR ${fmtMoney(res.mrr)} · ${fmtNum(res.customerCount)} customers`)
      dispatch({
        type: 'setConnectors',
        connectors: { stripe: 'connected', stripeEmail: res.accountEmail, lastSyncAt: new Date().toISOString(), mode: 'stripe-key' },
      })
      await refresh()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Connect failed')
    } finally { setBusy(false) }
  }

  async function startOauth() {
    setBusy(true); setErrMsg('')
    try {
      const res = await cloud.stripeOauthStart()
      if (res.authorizeUrl) window.location.href = res.authorizeUrl
      else setMsg(res.message || 'OAuth not configured — paste a restricted key instead.')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'OAuth failed')
    } finally { setBusy(false) }
  }

  async function publishTrust() {
    if (!localMetrics && !me?.stripe) {
      setErrMsg('Need local metrics or a Stripe connection to publish')
      return
    }
    setBusy(true); setErrMsg(''); setMsg('')
    try {
      const m = localMetrics
      const fromStripe = me?.trust?.source === 'stripe' && me.stripe
      const res = await cloud.publishTrust({
        companyName: state.workspace.name,
        publicSlug: trustSlug || undefined,
        isPublic: trustPublic,
        verifiedMrr: fromStripe && me?.trust ? me.trust.verifiedMrr : m!.mrr,
        verifiedArr: fromStripe && me?.trust ? me.trust.verifiedArr : m!.arr,
        customerCount: fromStripe && me?.trust ? me.trust.customerCount : m!.customers,
        sparkline: m?.sparkline,
        source: me?.stripe ? (m ? 'hybrid' : 'stripe') : 'csv',
        nrr: m?.nrr ?? null,
        growth: m?.growth ?? null,
        logoChurn: m?.logoChurn ?? null,
        quickRatio: m?.quick ?? null,
        month: m?.month,
      })
      setMsg(res.trust.publicUrl
        ? `Live at ${res.trust.publicUrl}`
        : 'Saved (not public)')
      await refresh()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Publish failed')
    } finally { setBusy(false) }
  }

  async function onUpload(file: File) {
    setBusy(true); setErrMsg(''); setMsg('')
    try {
      const res = await cloud.uploadFile(file, 'payments')
      setMsg(`Uploaded ${res.file.filename} to cloud`)
      await refresh()
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Upload failed')
    } finally { setBusy(false) }
  }

  const hasCloud = Boolean(getCloudToken())

  return (
    <div className="space-y-4">
      <ViewHeader index="00" kicker="Platform" title="Workspace & Connectors"
        sub="Cloud workspace · Stripe live sync · Trust page · file cloud" />

      <Callout tone="neutral">
        Without <span className="tabular-nums">DATABASE_URL</span>, cloud data persists in <span className="tabular-nums">./data</span> on this machine.
        Point at Neon Postgres + optional Vercel Blob for production. Stripe restricted keys are encrypted at rest.
      </Callout>

      {(msg || errMsg) && (
        <p className={`rounded-lg border px-3 py-2 text-[12px] ${errMsg ? 'border-neg/40 text-neg' : 'border-pos/40 text-pos'} tabular-nums`}>
          {errMsg || msg}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cloud workspace" sub={me ? me.storage : 'not linked'}>
          <label className="mb-3 block">
            <span className="text-[12px] text-ink-faint font-medium">Company name</span>
            <input className="mt-1 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
              value={state.workspace.name}
              onChange={(e) => dispatch({ type: 'setWorkspace', workspace: { name: e.target.value } })} />
          </label>
          <div className="text-[12px] text-ink-faint font-medium">Role lens</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button key={r.v} onClick={() => dispatch({ type: 'setWorkspace', workspace: { role: r.v } })}
                className={`rounded-md border px-3 py-1.5 text-[13px] transition-colors ${
                  state.workspace.role === r.v ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong text-ink-soft hover:bg-paper-2'
                }`}>{r.label}</button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!hasCloud ? (
              <button disabled={busy} onClick={createWs}
                className="rounded-md bg-side-accent px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">
                Create cloud workspace
              </button>
            ) : (
              <>
                <button disabled={busy} onClick={refresh}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2">Refresh</button>
                <button onClick={() => { setCloudToken(null); setMe(null); setMsg('Signed out of cloud workspace') }}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-neg hover:bg-paper-2">Disconnect workspace</button>
              </>
            )}
          </div>
          {me && (
            <p className="mt-3 text-[11px] text-ink-soft tabular-nums">
              slug <span className="text-ink">{me.workspace.slug}</span>
              {me.trust?.publicUrl && <> · trust <a className="text-side-accent underline" href={me.trust.publicUrl} target="_blank" rel="noreferrer">{me.trust.publicUrl}</a></>}
            </p>
          )}
        </Panel>

        <Panel title="Stripe" sub="restricted key now · Connect OAuth when configured">
          {!hasCloud ? (
            <p className="text-sm text-ink-soft">Create a cloud workspace first.</p>
          ) : (
            <div className="space-y-3">
              {me?.stripe?.status === 'connected' ? (
                <>
                  <p className="text-sm text-ink-soft">
                    Connected{me.stripe.accountEmail ? ` as ${me.stripe.accountEmail}` : ''} · last sync{' '}
                    {me.stripe.lastSyncAt ? new Date(me.stripe.lastSyncAt).toLocaleString() : '—'}
                  </p>
                  {me.trust && (
                    <p className="text-[12px] text-ink tabular-nums">
                      Verified MRR {fmtMoneyShort(me.trust.verifiedMrr)} · ARR {fmtMoneyShort(me.trust.verifiedArr)} · {fmtNum(me.trust.customerCount)} customers
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} onClick={async () => { setBusy(true); try { await cloud.syncStripe(); setMsg('Synced'); await refresh() } catch (e) { setErrMsg(String(e)) } finally { setBusy(false) } }}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] hover:bg-paper-2">Re-sync</button>
                    <button disabled={busy} onClick={async () => { setBusy(true); try { await cloud.disconnectStripe(); setMsg('Stripe disconnected'); await refresh() } catch (e) { setErrMsg(String(e)) } finally { setBusy(false) } }}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-neg hover:bg-paper-2">Disconnect</button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[12px] text-ink-faint font-medium">Restricted secret key (rk_… or sk_…)</span>
                    <input type="password" autoComplete="off" className="mt-1 w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-[12px] outline-none focus:border-accent tabular-nums"
                      placeholder="rk_live_…" value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} />
                  </label>
                  <p className="text-[10px] text-ink-faint tabular-nums">Create a Stripe restricted key with read-only Subscriptions + Customers. Never paste a key that can write charges.</p>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy || !stripeKey.trim()} onClick={connectKey}
                      className="rounded-md bg-side-accent px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50">Connect & sync</button>
                    <button disabled={busy} onClick={startOauth}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-[12px] text-ink-soft hover:bg-paper-2">Stripe Connect OAuth…</button>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="MRRmark Trust page" sub="public MRR source of truth">
          {!hasCloud ? (
            <p className="text-sm text-ink-soft">Create a cloud workspace to publish.</p>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="text-[12px] text-ink-faint font-medium">Public slug</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[12px] text-ink-faint tabular-nums">/trust/</span>
                  <input className="flex-1 rounded-md border border-line-strong bg-paper px-3 py-2 text-[12px] outline-none focus:border-accent tabular-nums"
                    value={trustSlug} onChange={(e) => setTrustSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                    placeholder="acme" />
                </div>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-accent" checked={trustPublic} onChange={(e) => setTrustPublic(e.target.checked)} />
                Make page public
              </label>
              {localMetrics && (
                <p className="text-[11px] text-ink-soft tabular-nums">
                  From this terminal: {fmtMoneyShort(localMetrics.mrr)} MRR · {fmtNum(localMetrics.customers)} customers
                  {me?.stripe ? ' · will mark hybrid if Stripe also connected' : ''}
                </p>
              )}
              <button disabled={busy} onClick={publishTrust}
                className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-ink disabled:opacity-50">
                Publish Trust page
              </button>
              {me?.trust?.publicUrl && (
                <div className="rounded-lg border border-line bg-paper-2 p-3 text-[11px] text-ink-soft tabular-nums">
                  <div>Page: <a className="text-side-accent underline" href={me.trust.publicUrl} target="_blank" rel="noreferrer">{me.trust.publicUrl}</a></div>
                  <div className="mt-1 break-all">Embed: {`<iframe src="${typeof location !== 'undefined' ? location.origin : ''}${me.trust.publicUrl}/badge" width="220" height="72" frameborder="0"></iframe>`}</div>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Cloud files" sub="CSV backups (Blob or local ./storage)">
          {!hasCloud ? (
            <p className="text-sm text-ink-soft">Create a cloud workspace to upload.</p>
          ) : (
            <>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
              <button disabled={busy} onClick={() => fileRef.current?.click()}
                className="rounded-md border border-line-strong px-4 py-2 text-[13px] hover:bg-paper-2 disabled:opacity-50">
                Upload payments CSV to cloud
              </button>
              <ul className="mt-3 space-y-1.5">
                {(me?.files ?? []).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-[11px] text-ink-soft tabular-nums">
                    <span className="truncate text-ink">{f.filename}</span>
                    <span>{Math.round(f.size / 1024)} KB · {f.kind}</span>
                  </li>
                ))}
                {!me?.files?.length && <li className="text-sm text-ink-faint">No files yet</li>}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
