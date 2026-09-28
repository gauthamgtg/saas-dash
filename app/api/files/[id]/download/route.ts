import { NextRequest } from 'next/server'
import { getFile } from '@/src/server/repo'
import { readLocalUpload } from '@/src/server/storage'
import { err, extractToken, requireWorkspace } from '@/src/server/http'
import { workspaceByToken } from '@/src/server/repo'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const file = await getFile(id)
  if (!file) return err('Not found', 404)

  // Allow download with workspace token ownership check
  const token = extractToken(req)
  if (token) {
    const ws = await workspaceByToken(token)
    if (!ws || ws.id !== file.workspaceId) return err('Forbidden', 403)
  } else {
    // Also allow via query token for simple links
    const q = req.nextUrl.searchParams.get('token')
    if (!q) return err('Unauthorized', 401)
    const ws = await workspaceByToken(q)
    if (!ws || ws.id !== file.workspaceId) return err('Forbidden', 403)
  }

  if (file.url.startsWith('http')) {
    return Response.redirect(file.url, 302)
  }

  const buf = await readLocalUpload(file.storageKey)
  if (!buf) return err('File missing on disk', 404)
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
      'Content-Length': String(buf.length),
    },
  })
}
