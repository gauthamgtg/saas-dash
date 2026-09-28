import { promises as fs } from 'fs'
import path from 'path'
import { put } from '@vercel/blob'

export type StoredBlob = { url: string; storageKey: string }

/**
 * Persist an upload. Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set;
 * otherwise writes under ./storage and serves via /api/files/[id]/download.
 */
export async function storeUpload(opts: {
  workspaceId: string
  filename: string
  mime: string
  bytes: Buffer
}): Promise<StoredBlob> {
  const key = `${opts.workspaceId}/${Date.now()}-${sanitize(opts.filename)}`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(key, opts.bytes, {
      access: 'public',
      contentType: opts.mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    return { url: blob.url, storageKey: key }
  }

  const abs = path.join(process.cwd(), 'storage', key)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, opts.bytes)
  // URL is filled in by caller once DB id exists — placeholder path
  return { url: `local:${key}`, storageKey: key }
}

export async function readLocalUpload(storageKey: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), 'storage', storageKey))
  } catch {
    return null
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}
