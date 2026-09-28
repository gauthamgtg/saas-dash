/**
 * Persistence layer.
 * - With DATABASE_URL: Prisma + Postgres (Neon).
 * - Without: local JSON store under ./data (dev / demo).
 */

import { promises as fs } from 'fs'
import path from 'path'
import { hashToken, newAccessToken, slugify } from './crypto'

export type WorkspaceRow = {
  id: string
  name: string
  slug: string
  tokenHash: string
  role: string
  website: string | null
  createdAt: string
  updatedAt: string
}

export type StripeRow = {
  id: string
  workspaceId: string
  mode: string
  encryptedSecret: string
  stripeAccountId: string | null
  accountEmail: string | null
  status: string
  lastSyncAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

export type TrustRow = {
  id: string
  workspaceId: string
  publicSlug: string
  isPublic: boolean
  companyName: string
  website: string | null
  source: string
  verifiedMrr: number
  verifiedArr: number
  customerCount: number
  sparklineJson: string
  currency: string
  lastVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export type FileRow = {
  id: string
  workspaceId: string
  filename: string
  mime: string
  size: number
  kind: string
  url: string
  storageKey: string
  createdAt: string
}

export type SnapshotRow = {
  id: string
  workspaceId: string
  month: string
  arrBand: string
  mrr: number
  arr: number
  customers: number
  nrr: number | null
  growth: number | null
  logoChurn: number | null
  quickRatio: number | null
  createdAt: string
}

type Store = {
  workspaces: WorkspaceRow[]
  stripe: StripeRow[]
  trust: TrustRow[]
  files: FileRow[]
  snapshots: SnapshotRow[]
}

const empty = (): Store => ({ workspaces: [], stripe: [], trust: [], files: [], snapshots: [] })

function dataPath() {
  return path.join(process.cwd(), 'data', 'ledger-cloud.json')
}

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(dataPath(), 'utf8')
    return { ...empty(), ...JSON.parse(raw) }
  } catch {
    return empty()
  }
}

async function writeStore(s: Store): Promise<void> {
  const dir = path.dirname(dataPath())
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(dataPath(), JSON.stringify(s, null, 2), 'utf8')
}

function cuid() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function now() {
  return new Date().toISOString()
}

export function usingPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

// ---- Prisma lazy (only if configured) ----------------------------------------

type PrismaClientLike = {
  workspace: any
  stripeConnection: any
  trustProfile: any
  cloudFile: any
  metricSnapshot: any
}

let prisma: PrismaClientLike | null = null

async function getPrisma(): Promise<PrismaClientLike | null> {
  if (!usingPostgres()) return null
  if (prisma) return prisma
  try {
    const mod = await import('@prisma/client')
    const g = globalThis as { __mrrmarkPrisma?: PrismaClientLike }
    prisma = g.__mrrmarkPrisma ?? new mod.PrismaClient()
    if (process.env.NODE_ENV !== 'production') g.__mrrmarkPrisma = prisma
    return prisma
  } catch (e) {
    console.warn('[ledger] Prisma client unavailable, falling back to file store:', e)
    return null
  }
}

// ---- Workspaces --------------------------------------------------------------

export async function createWorkspace(input: {
  name: string
  role?: string
  website?: string | null
  slug?: string
}): Promise<{ workspace: WorkspaceRow; accessToken: string }> {
  const accessToken = newAccessToken()
  const tokenHash = hashToken(accessToken)
  const baseSlug = slugify(input.slug || input.name)
  const p = await getPrisma()

  if (p) {
    let slug = baseSlug
    for (let i = 0; i < 5; i++) {
      try {
        const ws = await p.workspace.create({
          data: {
            name: input.name,
            slug,
            tokenHash,
            role: input.role ?? 'founder',
            website: input.website ?? null,
          },
        })
        return { workspace: serializeWs(ws), accessToken }
      } catch {
        slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      }
    }
    throw new Error('Could not allocate unique slug')
  }

  const s = await readStore()
  let slug = baseSlug
  while (s.workspaces.some((w) => w.slug === slug) || s.trust.some((t) => t.publicSlug === slug)) {
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }
  const workspace: WorkspaceRow = {
    id: cuid(),
    name: input.name,
    slug,
    tokenHash,
    role: input.role ?? 'founder',
    website: input.website ?? null,
    createdAt: now(),
    updatedAt: now(),
  }
  s.workspaces.push(workspace)
  await writeStore(s)
  return { workspace, accessToken }
}

export async function workspaceByToken(token: string): Promise<WorkspaceRow | null> {
  const tokenHash = hashToken(token)
  const p = await getPrisma()
  if (p) {
    const ws = await p.workspace.findUnique({ where: { tokenHash } })
    return ws ? serializeWs(ws) : null
  }
  const s = await readStore()
  return s.workspaces.find((w) => w.tokenHash === tokenHash) ?? null
}

export async function updateWorkspace(id: string, patch: Partial<Pick<WorkspaceRow, 'name' | 'role' | 'website'>>): Promise<WorkspaceRow | null> {
  const p = await getPrisma()
  if (p) {
    const ws = await p.workspace.update({ where: { id }, data: patch })
    return serializeWs(ws)
  }
  const s = await readStore()
  const i = s.workspaces.findIndex((w) => w.id === id)
  if (i < 0) return null
  s.workspaces[i] = { ...s.workspaces[i], ...patch, updatedAt: now() }
  await writeStore(s)
  return s.workspaces[i]
}

function serializeWs(ws: any): WorkspaceRow {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    tokenHash: ws.tokenHash,
    role: ws.role,
    website: ws.website ?? null,
    createdAt: ws.createdAt instanceof Date ? ws.createdAt.toISOString() : ws.createdAt,
    updatedAt: ws.updatedAt instanceof Date ? ws.updatedAt.toISOString() : ws.updatedAt,
  }
}

// ---- Stripe ------------------------------------------------------------------

export async function upsertStripe(workspaceId: string, data: {
  mode: string
  encryptedSecret: string
  stripeAccountId?: string | null
  accountEmail?: string | null
  status?: string
  lastSyncAt?: string | null
  lastError?: string | null
}): Promise<StripeRow> {
  const p = await getPrisma()
  if (p) {
    const row = await p.stripeConnection.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        mode: data.mode,
        encryptedSecret: data.encryptedSecret,
        stripeAccountId: data.stripeAccountId ?? null,
        accountEmail: data.accountEmail ?? null,
        status: data.status ?? 'connected',
        lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt) : null,
        lastError: data.lastError ?? null,
      },
      update: {
        mode: data.mode,
        encryptedSecret: data.encryptedSecret,
        stripeAccountId: data.stripeAccountId ?? null,
        accountEmail: data.accountEmail ?? null,
        status: data.status ?? 'connected',
        lastSyncAt: data.lastSyncAt ? new Date(data.lastSyncAt) : undefined,
        lastError: data.lastError ?? null,
      },
    })
    return serializeStripe(row)
  }
  const s = await readStore()
  const existing = s.stripe.find((x) => x.workspaceId === workspaceId)
  if (existing) {
    Object.assign(existing, data, { updatedAt: now() })
    await writeStore(s)
    return existing
  }
  const row: StripeRow = {
    id: cuid(),
    workspaceId,
    mode: data.mode,
    encryptedSecret: data.encryptedSecret,
    stripeAccountId: data.stripeAccountId ?? null,
    accountEmail: data.accountEmail ?? null,
    status: data.status ?? 'connected',
    lastSyncAt: data.lastSyncAt ?? null,
    lastError: data.lastError ?? null,
    createdAt: now(),
    updatedAt: now(),
  }
  s.stripe.push(row)
  await writeStore(s)
  return row
}

export async function getStripe(workspaceId: string): Promise<StripeRow | null> {
  const p = await getPrisma()
  if (p) {
    const row = await p.stripeConnection.findUnique({ where: { workspaceId } })
    return row ? serializeStripe(row) : null
  }
  const s = await readStore()
  return s.stripe.find((x) => x.workspaceId === workspaceId) ?? null
}

export async function deleteStripe(workspaceId: string): Promise<void> {
  const p = await getPrisma()
  if (p) {
    await p.stripeConnection.deleteMany({ where: { workspaceId } })
    return
  }
  const s = await readStore()
  s.stripe = s.stripe.filter((x) => x.workspaceId !== workspaceId)
  await writeStore(s)
}

function serializeStripe(row: any): StripeRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    mode: row.mode,
    encryptedSecret: row.encryptedSecret,
    stripeAccountId: row.stripeAccountId ?? null,
    accountEmail: row.accountEmail ?? null,
    status: row.status,
    lastSyncAt: row.lastSyncAt instanceof Date ? row.lastSyncAt.toISOString() : row.lastSyncAt,
    lastError: row.lastError ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

// ---- Trust -------------------------------------------------------------------

export async function upsertTrust(workspaceId: string, data: Partial<Omit<TrustRow, 'id' | 'workspaceId' | 'createdAt'>> & {
  publicSlug: string
  companyName: string
}): Promise<TrustRow> {
  const p = await getPrisma()
  if (p) {
    const row = await p.trustProfile.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        publicSlug: data.publicSlug,
        isPublic: data.isPublic ?? false,
        companyName: data.companyName,
        website: data.website ?? null,
        source: data.source ?? 'csv',
        verifiedMrr: data.verifiedMrr ?? 0,
        verifiedArr: data.verifiedArr ?? 0,
        customerCount: data.customerCount ?? 0,
        sparklineJson: data.sparklineJson ?? '[]',
        currency: data.currency ?? 'USD',
        lastVerifiedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : null,
      },
      update: {
        publicSlug: data.publicSlug,
        isPublic: data.isPublic,
        companyName: data.companyName,
        website: data.website,
        source: data.source,
        verifiedMrr: data.verifiedMrr,
        verifiedArr: data.verifiedArr,
        customerCount: data.customerCount,
        sparklineJson: data.sparklineJson,
        currency: data.currency,
        lastVerifiedAt: data.lastVerifiedAt ? new Date(data.lastVerifiedAt) : undefined,
      },
    })
    return serializeTrust(row)
  }
  const s = await readStore()
  const existing = s.trust.find((t) => t.workspaceId === workspaceId)
  if (existing) {
    Object.assign(existing, data, { updatedAt: now() })
    await writeStore(s)
    return existing
  }
  // ensure unique public slug
  let publicSlug = data.publicSlug
  while (s.trust.some((t) => t.publicSlug === publicSlug)) {
    publicSlug = `${data.publicSlug}-${Math.random().toString(36).slice(2, 5)}`
  }
  const row: TrustRow = {
    id: cuid(),
    workspaceId,
    publicSlug,
    isPublic: data.isPublic ?? false,
    companyName: data.companyName,
    website: data.website ?? null,
    source: data.source ?? 'csv',
    verifiedMrr: data.verifiedMrr ?? 0,
    verifiedArr: data.verifiedArr ?? 0,
    customerCount: data.customerCount ?? 0,
    sparklineJson: data.sparklineJson ?? '[]',
    currency: data.currency ?? 'USD',
    lastVerifiedAt: data.lastVerifiedAt ?? null,
    createdAt: now(),
    updatedAt: now(),
  }
  s.trust.push(row)
  await writeStore(s)
  return row
}

export async function getTrustByWorkspace(workspaceId: string): Promise<TrustRow | null> {
  const p = await getPrisma()
  if (p) {
    const row = await p.trustProfile.findUnique({ where: { workspaceId } })
    return row ? serializeTrust(row) : null
  }
  const s = await readStore()
  return s.trust.find((t) => t.workspaceId === workspaceId) ?? null
}

export async function getPublicTrust(publicSlug: string): Promise<TrustRow | null> {
  const p = await getPrisma()
  if (p) {
    const row = await p.trustProfile.findFirst({ where: { publicSlug, isPublic: true } })
    return row ? serializeTrust(row) : null
  }
  const s = await readStore()
  return s.trust.find((t) => t.publicSlug === publicSlug && t.isPublic) ?? null
}

function serializeTrust(row: any): TrustRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    publicSlug: row.publicSlug,
    isPublic: row.isPublic,
    companyName: row.companyName,
    website: row.website ?? null,
    source: row.source,
    verifiedMrr: row.verifiedMrr,
    verifiedArr: row.verifiedArr,
    customerCount: row.customerCount,
    sparklineJson: row.sparklineJson,
    currency: row.currency,
    lastVerifiedAt: row.lastVerifiedAt instanceof Date ? row.lastVerifiedAt.toISOString() : row.lastVerifiedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

// ---- Files -------------------------------------------------------------------

export async function addFile(row: Omit<FileRow, 'id' | 'createdAt'>): Promise<FileRow> {
  const p = await getPrisma()
  if (p) {
    const created = await p.cloudFile.create({ data: row })
    return serializeFile(created)
  }
  const s = await readStore()
  const full: FileRow = { ...row, id: cuid(), createdAt: now() }
  s.files.push(full)
  await writeStore(s)
  return full
}

export async function listFiles(workspaceId: string): Promise<FileRow[]> {
  const p = await getPrisma()
  if (p) {
    const rows = await p.cloudFile.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } })
    return rows.map(serializeFile)
  }
  const s = await readStore()
  return s.files.filter((f) => f.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getFile(id: string): Promise<FileRow | null> {
  const p = await getPrisma()
  if (p) {
    const row = await p.cloudFile.findUnique({ where: { id } })
    return row ? serializeFile(row) : null
  }
  const s = await readStore()
  return s.files.find((f) => f.id === id) ?? null
}

function serializeFile(row: any): FileRow {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    filename: row.filename,
    mime: row.mime,
    size: row.size,
    kind: row.kind,
    url: row.url,
    storageKey: row.storageKey,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  }
}

// ---- Snapshots / network benchmarks ------------------------------------------

export async function upsertSnapshot(data: Omit<SnapshotRow, 'id' | 'createdAt'>): Promise<void> {
  const p = await getPrisma()
  if (p) {
    await p.metricSnapshot.upsert({
      where: { workspaceId_month: { workspaceId: data.workspaceId, month: data.month } },
      create: data,
      update: {
        arrBand: data.arrBand,
        mrr: data.mrr,
        arr: data.arr,
        customers: data.customers,
        nrr: data.nrr,
        growth: data.growth,
        logoChurn: data.logoChurn,
        quickRatio: data.quickRatio,
      },
    })
    return
  }
  const s = await readStore()
  const i = s.snapshots.findIndex((x) => x.workspaceId === data.workspaceId && x.month === data.month)
  if (i >= 0) s.snapshots[i] = { ...s.snapshots[i], ...data }
  else s.snapshots.push({ ...data, id: cuid(), createdAt: now() })
  await writeStore(s)
}

export async function networkBandStats(arrBand: string): Promise<{
  n: number
  mrrMedian: number | null
  arrMedian: number | null
  growthMedian: number | null
  nrrMedian: number | null
  logoChurnMedian: number | null
  quickMedian: number | null
}> {
  const p = await getPrisma()
  let rows: SnapshotRow[] = []
  if (p) {
    const latest = await p.metricSnapshot.findMany({
      where: { arrBand },
      orderBy: { month: 'desc' },
      take: 500,
    })
    // keep latest month per workspace
    const seen = new Set<string>()
    for (const r of latest) {
      if (seen.has(r.workspaceId)) continue
      seen.add(r.workspaceId)
      rows.push({
        id: r.id,
        workspaceId: r.workspaceId,
        month: r.month,
        arrBand: r.arrBand,
        mrr: r.mrr,
        arr: r.arr,
        customers: r.customers,
        nrr: r.nrr,
        growth: r.growth,
        logoChurn: r.logoChurn,
        quickRatio: r.quickRatio,
        createdAt: r.createdAt.toISOString(),
      })
    }
  } else {
    const s = await readStore()
    const band = s.snapshots.filter((x) => x.arrBand === arrBand).sort((a, b) => b.month.localeCompare(a.month))
    const seen = new Set<string>()
    for (const r of band) {
      if (seen.has(r.workspaceId)) continue
      seen.add(r.workspaceId)
      rows.push(r)
    }
  }

  const med = (vals: number[]) => {
    if (!vals.length) return null
    const a = [...vals].sort((x, y) => x - y)
    const mid = Math.floor(a.length / 2)
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
  }

  return {
    n: rows.length,
    mrrMedian: med(rows.map((r) => r.mrr)),
    arrMedian: med(rows.map((r) => r.arr)),
    growthMedian: med(rows.map((r) => r.growth).filter((v): v is number => v != null)),
    nrrMedian: med(rows.map((r) => r.nrr).filter((v): v is number => v != null)),
    logoChurnMedian: med(rows.map((r) => r.logoChurn).filter((v): v is number => v != null)),
    quickMedian: med(rows.map((r) => r.quickRatio).filter((v): v is number => v != null)),
  }
}
