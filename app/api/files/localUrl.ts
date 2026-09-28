import { promises as fs } from 'fs'
import path from 'path'
import { usingPostgres } from '@/src/server/repo'

/** Patch a CloudFile.url after id is known (local storage only). */
export async function upsertLocalUrl(id: string, url: string) {
  if (usingPostgres()) {
    try {
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient()
      await prisma.cloudFile.update({ where: { id }, data: { url } })
      await prisma.$disconnect()
      return
    } catch {
      // fall through to file store
    }
  }
  const p = path.join(process.cwd(), 'data', 'ledger-cloud.json')
  try {
    const s = JSON.parse(await fs.readFile(p, 'utf8'))
    const f = s.files?.find((x: { id: string }) => x.id === id)
    if (f) {
      f.url = url
      await fs.writeFile(p, JSON.stringify(s, null, 2))
    }
  } catch { /* ignore */ }
}
