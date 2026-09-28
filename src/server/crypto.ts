import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto'

const ALGO = 'aes-256-gcm'

function keyMaterial(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || process.env.DATABASE_URL || 'ledger-dev-only-insecure-key'
  return scryptSync(raw, 'ledger-stripe-v1', 32)
}

/** Encrypt a secret (Stripe restricted key) for DB storage. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, keyMaterial(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${enc.toString('base64url')}`
}

export function decryptSecret(payload: string): string {
  const [v, ivB, tagB, dataB] = payload.split(':')
  if (v !== 'v1' || !ivB || !tagB || !dataB) throw new Error('Invalid ciphertext')
  const decipher = createDecipheriv(ALGO, keyMaterial(), Buffer.from(ivB, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]).toString('utf8')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newAccessToken(): string {
  return `ldg_${randomBytes(24).toString('base64url')}`
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || `workspace-${randomBytes(3).toString('hex')}`
}
