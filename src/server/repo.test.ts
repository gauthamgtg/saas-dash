import { describe, expect, it, beforeEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { createWorkspace, upsertTrust, getPublicTrust, networkBandStats, upsertSnapshot } from './repo'

const DATA = path.join(process.cwd(), 'data', 'ledger-cloud.json')

function arrBandKey(arr: number): string {
  if (arr < 1e6) return '<$1M'
  if (arr < 3e6) return '$1–3M'
  if (arr < 1e7) return '$3–10M'
  if (arr < 3e7) return '$10–30M'
  return '>$30M'
}

describe('cloud repo (file store)', () => {
  beforeEach(async () => {
    try { await fs.unlink(DATA) } catch { /* */ }
  })

  it('creates a workspace and publishes a public trust page', async () => {
    const { workspace, accessToken } = await createWorkspace({ name: 'Peer Co' })
    expect(accessToken.startsWith('ldg_')).toBe(true)
    expect(workspace.slug).toContain('peer')

    const trust = await upsertTrust(workspace.id, {
      publicSlug: 'peer-co',
      companyName: 'Peer Co',
      isPublic: true,
      source: 'csv',
      verifiedMrr: 10_000,
      verifiedArr: 120_000,
      customerCount: 40,
      sparklineJson: JSON.stringify([8000, 9000, 10000]),
      currency: 'USD',
      lastVerifiedAt: new Date().toISOString(),
    })
    expect(trust.publicSlug).toBe('peer-co')

    const pub = await getPublicTrust('peer-co')
    expect(pub?.verifiedMrr).toBe(10_000)

    await upsertSnapshot({
      workspaceId: workspace.id,
      month: '2026-07',
      arrBand: arrBandKey(120_000),
      mrr: 10_000,
      arr: 120_000,
      customers: 40,
      nrr: 1.05,
      growth: 0.4,
      logoChurn: 0.2,
      quickRatio: 2.1,
    })

    const net = await networkBandStats(arrBandKey(120_000))
    expect(net.n).toBeGreaterThanOrEqual(1)
    expect(net.mrrMedian).toBe(10_000)
  })
})
