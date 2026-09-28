import { NextRequest } from 'next/server'
import { z } from 'zod'
import { encryptSecret, decryptSecret } from '@/src/server/crypto'
import { deleteStripe, getStripe, upsertStripe, upsertTrust, upsertSnapshot, getTrustByWorkspace } from '@/src/server/repo'
import { err, json, requireWorkspace, appUrl } from '@/src/server/http'
import { syncStripeMrr } from '@/src/server/stripeSync'
import { arrBandKey } from '@/src/lib/benchmarks'
import { slugify } from '@/src/server/crypto'

const ConnectBody = z.object({
  secretKey: z.string().min(10),
  mode: z.enum(['key', 'oauth']).default('key'),
})

/** POST connect restricted Stripe key and run first sync */
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  try {
    const body = ConnectBody.parse(await req.json())
    const snap = await syncStripeMrr(body.secretKey)
    await upsertStripe(auth.workspace.id, {
      mode: body.mode,
      encryptedSecret: encryptSecret(body.secretKey),
      stripeAccountId: snap.accountId,
      accountEmail: snap.accountEmail,
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    })

    const existing = await getTrustByWorkspace(auth.workspace.id)
    const publicSlug = existing?.publicSlug || slugify(auth.workspace.slug || auth.workspace.name)
    const trust = await upsertTrust(auth.workspace.id, {
      publicSlug,
      companyName: existing?.companyName || auth.workspace.name,
      website: auth.workspace.website,
      isPublic: existing?.isPublic ?? false,
      source: 'stripe',
      verifiedMrr: snap.mrr,
      verifiedArr: snap.arr,
      customerCount: snap.customerCount,
      sparklineJson: JSON.stringify(snap.sparkline),
      currency: snap.currency,
      lastVerifiedAt: new Date().toISOString(),
    })

    await upsertSnapshot({
      workspaceId: auth.workspace.id,
      month: snap.month,
      arrBand: arrBandKey(snap.arr),
      mrr: snap.mrr,
      arr: snap.arr,
      customers: snap.customerCount,
      nrr: null,
      growth: null,
      logoChurn: null,
      quickRatio: null,
    })

    return json({
      ok: true,
      mrr: snap.mrr,
      arr: snap.arr,
      customerCount: snap.customerCount,
      currency: snap.currency,
      accountEmail: snap.accountEmail,
      trust: {
        publicSlug: trust.publicSlug,
        isPublic: trust.isPublic,
        publicUrl: trust.isPublic ? appUrl(`/trust/${trust.publicSlug}`) : null,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Stripe sync failed'
    try {
      await upsertStripe(auth.workspace.id, {
        mode: 'key',
        encryptedSecret: encryptSecret('invalid'),
        status: 'error',
        lastError: message,
      })
    } catch { /* ignore */ }
    return err(message, 400)
  }
}

/** POST /api/stripe/sync — re-sync with stored key */
export async function PUT(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  const row = await getStripe(auth.workspace.id)
  if (!row) return err('No Stripe connection', 404)
  try {
    const secret = decryptSecret(row.encryptedSecret)
    const snap = await syncStripeMrr(secret)
    await upsertStripe(auth.workspace.id, {
      mode: row.mode,
      encryptedSecret: row.encryptedSecret,
      stripeAccountId: snap.accountId,
      accountEmail: snap.accountEmail,
      status: 'connected',
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    })
    const existing = await getTrustByWorkspace(auth.workspace.id)
    if (existing) {
      await upsertTrust(auth.workspace.id, {
        publicSlug: existing.publicSlug,
        companyName: existing.companyName,
        website: existing.website,
        isPublic: existing.isPublic,
        source: 'stripe',
        verifiedMrr: snap.mrr,
        verifiedArr: snap.arr,
        customerCount: snap.customerCount,
        sparklineJson: JSON.stringify(snap.sparkline),
        currency: snap.currency,
        lastVerifiedAt: new Date().toISOString(),
      })
    }
    await upsertSnapshot({
      workspaceId: auth.workspace.id,
      month: snap.month,
      arrBand: arrBandKey(snap.arr),
      mrr: snap.mrr,
      arr: snap.arr,
      customers: snap.customerCount,
      nrr: null, growth: null, logoChurn: null, quickRatio: null,
    })
    return json({ ok: true, mrr: snap.mrr, arr: snap.arr, customerCount: snap.customerCount, currency: snap.currency })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Sync failed', 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  await deleteStripe(auth.workspace.id)
  return json({ ok: true })
}

/** OAuth connect placeholder — needs STRIPE_CLIENT_ID + STRIPE_SECRET_KEY */
export async function GET(req: NextRequest) {
  const clientId = process.env.STRIPE_CLIENT_ID
  if (!clientId) {
    return json({
      oauth: false,
      message: 'Stripe Connect OAuth is not configured. Use a restricted API key (POST) for now.',
      setup: ['Set STRIPE_CLIENT_ID and STRIPE_SECRET_KEY', 'Register redirect URI /api/stripe/oauth/callback'],
    })
  }
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  const state = Buffer.from(JSON.stringify({ workspaceId: auth.workspace.id })).toString('base64url')
  const url = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=read_only&state=${state}&redirect_uri=${encodeURIComponent(appUrl('/api/stripe/oauth/callback'))}`
  return json({ oauth: true, authorizeUrl: url })
}
