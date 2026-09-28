import { describe, expect, it } from 'vitest'
import { encryptSecret, decryptSecret, hashToken, slugify } from './crypto'

describe('server crypto', () => {
  it('round-trips secrets', () => {
    const enc = encryptSecret('rk_test_hello')
    expect(enc.startsWith('v1:')).toBe(true)
    expect(decryptSecret(enc)).toBe('rk_test_hello')
  })

  it('hashes tokens stably', () => {
    expect(hashToken('ldg_abc')).toBe(hashToken('ldg_abc'))
    expect(hashToken('a')).not.toBe(hashToken('b'))
  })

  it('slugifies names', () => {
    expect(slugify('Acme Corp!')).toBe('acme-corp')
  })
})
