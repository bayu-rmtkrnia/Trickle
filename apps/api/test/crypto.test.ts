import { describe, expect, it } from 'vitest'
import { createFieldCipher } from '../src/lib/crypto.js'

const key = 'ab'.repeat(32)
const cipher = createFieldCipher(key)

describe('field cipher', () => {
  it('round-trips and never stores the plain value', () => {
    const token = cipher.encrypt('1234567890', 'user-1')
    expect(token).toMatch(/^v1\./)
    expect(token).not.toContain('1234567890')
    expect(cipher.decrypt(token, 'user-1')).toBe('1234567890')
  })

  it('uses a fresh IV every time', () => {
    expect(cipher.encrypt('1234567890', 'u')).not.toBe(cipher.encrypt('1234567890', 'u'))
  })

  it('refuses a value moved to another owner', () => {
    const token = cipher.encrypt('1234567890', 'user-1')
    expect(() => cipher.decrypt(token, 'user-2')).toThrow()
  })

  it('refuses a tampered value', () => {
    const [v, iv, tag, ct] = cipher.encrypt('1234567890', 'u').split('.')
    const flipped = Buffer.from(ct!, 'base64url')
    flipped[0]! ^= 1
    expect(() =>
      cipher.decrypt([v, iv, tag, flipped.toString('base64url')].join('.'), 'u'),
    ).toThrow()
  })

  it('cannot be read with another key', () => {
    const token = cipher.encrypt('1234567890', 'u')
    expect(() => createFieldCipher('cd'.repeat(32)).decrypt(token, 'u')).toThrow()
  })

  it('fingerprints deterministically, per key', () => {
    expect(cipher.fingerprint('BCA:123')).toBe(cipher.fingerprint('BCA:123'))
    expect(cipher.fingerprint('BCA:123')).not.toBe(cipher.fingerprint('BNI:123'))
    expect(createFieldCipher('cd'.repeat(32)).fingerprint('BCA:123')).not.toBe(
      cipher.fingerprint('BCA:123'),
    )
  })

  it('rejects a key of the wrong size', () => {
    expect(() => createFieldCipher('abcd')).toThrow(/32 bytes/)
  })
})
