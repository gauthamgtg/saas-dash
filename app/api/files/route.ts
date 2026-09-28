import { NextRequest } from 'next/server'
import { addFile, listFiles } from '@/src/server/repo'
import { storeUpload } from '@/src/server/storage'
import { err, json, requireWorkspace, appUrl } from '@/src/server/http'

const KINDS = new Set(['payments', 'spend', 'pipeline', 'other'])

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  const files = await listFiles(auth.workspace.id)
  return json({ files })
}

export async function POST(req: NextRequest) {
  const auth = await requireWorkspace(req)
  if ('error' in auth) return auth.error
  try {
    const form = await req.formData()
    const file = form.get('file')
    const kindRaw = String(form.get('kind') || 'payments')
    const kind = KINDS.has(kindRaw) ? kindRaw : 'other'
    if (!(file instanceof File)) return err('file required')

    const bytes = Buffer.from(await file.arrayBuffer())
    if (bytes.length > 25 * 1024 * 1024) return err('Max file size is 25MB')

    const stored = await storeUpload({
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      bytes,
    })

    // Placeholder local URL until we have id
    const draft = await addFile({
      workspaceId: auth.workspace.id,
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size: bytes.length,
      kind,
      url: stored.url.startsWith('local:') ? 'pending' : stored.url,
      storageKey: stored.storageKey,
    })

    if (stored.url.startsWith('local:')) {
      // Rewrite URL to authenticated download endpoint
      const { upsertLocalUrl } = await import('./localUrl')
      const url = appUrl(`/api/files/${draft.id}/download`)
      await upsertLocalUrl(draft.id, url)
      return json({ file: { ...draft, url } }, 201)
    }

    return json({ file: draft }, 201)
  } catch (e) {
    return err(e instanceof Error ? e.message : 'Upload failed', 500)
  }
}
