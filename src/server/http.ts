import { NextRequest, NextResponse } from 'next/server'
import { workspaceByToken } from './repo'

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** Extract Bearer token or x-ledger-token header. */
export function extractToken(req: NextRequest): string | null {
  const h = req.headers.get('authorization')
  if (h?.toLowerCase().startsWith('bearer ')) return h.slice(7).trim()
  return req.headers.get('x-ledger-token')?.trim() || null
}

export async function requireWorkspace(req: NextRequest) {
  const token = extractToken(req)
  if (!token) return { error: err('Missing workspace token', 401) as NextResponse }
  const workspace = await workspaceByToken(token)
  if (!workspace) return { error: err('Invalid workspace token', 401) as NextResponse }
  return { workspace, token }
}

export function appUrl(path = '') {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
}
