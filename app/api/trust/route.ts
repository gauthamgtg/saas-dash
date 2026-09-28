import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getTrustByWorkspace, upsertTrust, upsertSnapshot } from '@/src/server/repo'
import { err, json, requireWorkspace, appUrl } from '@/src/server/http'
import { slugify } from '@/src/server/crypto'
import { arrBandKey } from '@/src/lib/benchmarks'

const Publish = z.object({
  companyName: z.string().min(1).max(120),
  publicSlug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/).optional(),
  website: z.string().url().nullable().optional(),
  isPublic: z.boolean().default(true),
  /** Push verified numbers from the local terminal (CSV path) */
  verifiedMrr: z.number().nonnegative(),
  verifiedArr: z.number().nonnegative(),
  customerCount: z.number().int().nonnegative(),
  sparkline: z.array(z.number()).max(36).optional(),
  currency: z.string().min(3).max(3).default('USD'),
  source: z.enum(['csv', 'stripe', 'hybrid']).default('csv'),
  /** Optional richer metrics for network benchmarks */
  nrr: z.number().nullable().optional(),
  growth: z.number().nullable().optional(),
  logoChurn: z.number().nullable().optional(),
  quickRatio: z.number().nullable().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

/** Publish / update Trust page from workspace (Stripe sync or local CSV metrics). */
export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  try {
    const body = Publish.parse(await req.json())
    const existing = await getTrustByWorkspace(auth.workspace.id)
    const publicSlug = body.publicSlug || existing?.publicSlug || slugify(body.companyName)
    const trust = await upsertTrust(auth.workspace.id, {
      publicSlug,
      companyName: body.companyName,
      website: body.website === undefined ? (existing?.website ?? auth.workspace.website) : body.website,
      isPublic: body.isPublic,
      source: body.source,
      verifiedMrr: body.verifiedMrr,
      verifiedArr: body.verifiedArr,
      customerCount: body.customerCount,
      sparklineJson: JSON.stringify(body.sparkline ?? (existing ? JSON.parse(existing.sparklineJson || '[]') : [])),
      currency: body.currency,
      lastVerifiedAt: new Date().toISOString(),
    })

    const month = body.month || new Date().toISOString().slice(0, 7)
    if (body.isPublic) {
      await upsertSnapshot({
        workspaceId: auth.workspace.id,
        month,
        arrBand: arrBandKey(body.verifiedArr),
        mrr: body.verifiedMrr,
        arr: body.verifiedArr,
        customers: body.customerCount,
        nrr: body.nrr ?? null,
        growth: body.growth ?? null,
        logoChurn: body.logoChurn ?? null,
        quickRatio: body.quickRatio ?? null,
      })
    }

    return json({
      trust: {
        ...publicTrustDto(trust),
        publicUrl: trust.isPublic ? appUrl(`/trust/${trust.publicSlug}`) : null,
        embedUrl: trust.isPublic ? appUrl(`/trust/${trust.publicSlug}/badge`) : null,
      },
    })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Publish failed', 400)
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  const trust = await getTrustByWorkspace(auth.workspace.id)
  if (!trust) return json({ trust: null })
  return json({
    trust: {
      ...publicTrustDto(trust),
      publicUrl: trust.isPublic ? appUrl(`/trust/${trust.publicSlug}`) : null,
      embedUrl: trust.isPublic ? appUrl(`/trust/${trust.publicSlug}/badge`) : null,
    },
  })
}

function publicTrustDto(trust: Awaited<ReturnType<typeof getTrustByWorkspace>> & object) {
  if (!trust) return null
  return {
    publicSlug: trust.publicSlug,
    isPublic: trust.isPublic,
    companyName: trust.companyName,
    website: trust.website,
    source: trust.source,
    verifiedMrr: trust.verifiedMrr,
    verifiedArr: trust.verifiedArr,
    customerCount: trust.customerCount,
    sparkline: JSON.parse(trust.sparklineJson || '[]') as number[],
    currency: trust.currency,
    lastVerifiedAt: trust.lastVerifiedAt,
  }
}
