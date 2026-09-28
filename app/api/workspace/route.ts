import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createWorkspace, usingPostgres, workspaceByToken, updateWorkspace, getStripe, getTrustByWorkspace, listFiles } from '@/src/server/repo'
import { err, extractToken, json, requireWorkspace } from '@/src/server/http'

const Create = z.object({
  name: z.string().min(1).max(120),
  role: z.enum(['founder', 'analyst', 'investor', 'advisor']).optional(),
  website: z.string().url().optional().nullable(),
})

/** POST create workspace · GET current workspace (+ stripe/trust/files summary) */
export async function POST(req: NextRequest) {
  try {
    const body = Create.parse(await req.json())
    const { workspace, accessToken } = await createWorkspace(body)
    return json({
      workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: workspace.role, website: workspace.website },
      accessToken,
      storage: usingPostgres() ? 'postgres' : 'local-file',
      message: 'Store accessToken securely — it cannot be recovered.',
    }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Invalid request', 400)
  }
}

export async function GET(req: NextRequest) {
  const token = extractToken(req)
  if (!token) return err('Missing workspace token', 401)
  const workspace = await workspaceByToken(token)
  if (!workspace) return err('Invalid workspace token', 401)
  const [stripe, trust, files] = await Promise.all([
    getStripe(workspace.id),
    getTrustByWorkspace(workspace.id),
    listFiles(workspace.id),
  ])
  return json({
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, role: workspace.role, website: workspace.website },
    stripe: stripe ? {
      mode: stripe.mode,
      status: stripe.status,
      accountEmail: stripe.accountEmail,
      lastSyncAt: stripe.lastSyncAt,
      lastError: stripe.lastError,
    } : null,
    trust: trust ? {
      publicSlug: trust.publicSlug,
      isPublic: trust.isPublic,
      companyName: trust.companyName,
      verifiedMrr: trust.verifiedMrr,
      verifiedArr: trust.verifiedArr,
      customerCount: trust.customerCount,
      source: trust.source,
      lastVerifiedAt: trust.lastVerifiedAt,
      publicUrl: trust.isPublic ? `/trust/${trust.publicSlug}` : null,
    } : null,
    files: files.map((f) => ({ id: f.id, filename: f.filename, kind: f.kind, size: f.size, url: f.url, createdAt: f.createdAt })),
    storage: usingPostgres() ? 'postgres' : 'local-file',
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  try {
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      role: z.enum(['founder', 'analyst', 'investor', 'advisor']).optional(),
      website: z.string().url().nullable().optional(),
    }).parse(await req.json())
    const ws = await updateWorkspace(auth.workspace.id, body)
    return json({ workspace: ws })
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Invalid request', 400)
  }
}
