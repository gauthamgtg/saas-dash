import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { err, json, appUrl } from '@/src/server/http'
import { encryptSecret } from '@/src/server/crypto'
import { upsertStripe, upsertTrust, getTrustByWorkspace, upsertSnapshot } from '@/src/server/repo'
import { syncStripeMrr } from '@/src/server/stripeSync'
import { arrBandKey } from '@/src/lib/benchmarks'
import { slugify } from '@/src/server/crypto'

/**
 * Stripe Connect OAuth callback.
 * Requires STRIPE_CLIENT_ID + STRIPE_SECRET_KEY (platform).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const oauthErr = req.nextUrl.searchParams.get('error')
  if (oauthErr) return err(`Stripe OAuth error: ${oauthErr}`, 400)
  if (!code || !state) return err('Missing code/state', 400)

  const secret = process.env.STRIPE_SECRET_KEY
  const clientId = process.env.STRIPE_CLIENT_ID
  if (!secret || !clientId) return err('Stripe Connect not configured on server', 501)

  let workspaceId: string
  try {
    workspaceId = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')).workspaceId
  } catch {
    return err('Invalid state', 400)
  }

  const stripe = new Stripe(secret)
  const tok = await stripe.oauth.token({ grant_type: 'authorization_code', code })
  const connectedAccountId = tok.stripe_user_id
  if (!connectedAccountId || !tok.access_token) return err('OAuth token exchange failed', 400)

  // access_token is a restricted key for the connected account
  const snap = await syncStripeMrr(tok.access_token)
  await upsertStripe(workspaceId, {
    mode: 'oauth',
    encryptedSecret: encryptSecret(tok.access_token),
    stripeAccountId: connectedAccountId,
    accountEmail: snap.accountEmail,
    status: 'connected',
    lastSyncAt: new Date().toISOString(),
    lastError: null,
  })

  const existing = await getTrustByWorkspace(workspaceId)
  await upsertTrust(workspaceId, {
    publicSlug: existing?.publicSlug || slugify(connectedAccountId),
    companyName: existing?.companyName || 'My company',
    website: existing?.website ?? null,
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
    workspaceId,
    month: snap.month,
    arrBand: arrBandKey(snap.arr),
    mrr: snap.mrr,
    arr: snap.arr,
    customers: snap.customerCount,
    nrr: null, growth: null, logoChurn: null, quickRatio: null,
  })

  // Redirect back to app with success flag
  return Response.redirect(appUrl(`/?stripe=connected`), 302)
}
