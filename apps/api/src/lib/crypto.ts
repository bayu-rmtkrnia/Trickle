import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto'

/**
 * Encrypts sensitive fields before they reach Postgres (PLAN §6.3, K4), so a
 * leaked database or backup does not expose them.
 */
export interface FieldCipher {
  /** AES-256-GCM. `context` (e.g. the owner's user id) is bound as AAD, so a
   * ciphertext copied to another user's row fails to decrypt. */
  encrypt(plain: string, context: string): string
  decrypt(token: string, context: string): string
  /** Keyed hash for equality checks (duplicates) without decrypting. */
  fingerprint(plain: string): string
}

const VERSION = 'v1'
const IV_BYTES = 12

const b64 = (b: Buffer) => b.toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url')

/**
 * `keyHex` is 32 random bytes (`openssl rand -hex 32`). Separate subkeys are
 * derived for encryption and fingerprints, so neither use weakens the other.
 * Tokens look like `v1.<iv>.<tag>.<ciphertext>`; the version leaves room for
 * key rotation later.
 */
export function createFieldCipher(keyHex: string): FieldCipher {
  const master = Buffer.from(keyHex, 'hex')
  if (master.length !== 32) throw new Error('Encryption key must be 32 bytes of hex')
  const derive = (info: string) =>
    Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32))
  const encKey = derive('trickle:field-encryption')
  const macKey = derive('trickle:field-fingerprint')

  return {
    encrypt(plain, context) {
      const iv = randomBytes(IV_BYTES)
      const cipher = createCipheriv('aes-256-gcm', encKey, iv)
      cipher.setAAD(Buffer.from(context))
      const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
      return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.')
    },

    decrypt(token, context) {
      const [version, iv, tag, ciphertext] = token.split('.')
      if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
        throw new Error('Unrecognised encrypted value')
      }
      const decipher = createDecipheriv('aes-256-gcm', encKey, unb64(iv))
      decipher.setAAD(Buffer.from(context))
      decipher.setAuthTag(unb64(tag))
      return Buffer.concat([decipher.update(unb64(ciphertext)), decipher.final()]).toString('utf8')
    },

    fingerprint(plain) {
      return createHmac('sha256', macKey).update(plain).digest('base64url')
    },
  }
}
