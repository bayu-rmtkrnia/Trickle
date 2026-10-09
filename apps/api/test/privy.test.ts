import { exportSPKI, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createPrivy } from '../src/lib/privy.js'

const appId = 'test-app'
type KeyPair = Awaited<ReturnType<typeof generateKeyPair>>
let privateKey: KeyPair['privateKey']
let pem: string

beforeAll(async () => {
  const pair = await generateKeyPair('ES256', { extractable: true })
  privateKey = pair.privateKey
  pem = await exportSPKI(pair.publicKey)
})

/** Mimics a Privy access token: ES256, iss privy.io, aud = app id, sub = Privy DID. */
function accessToken(claims: { iss?: string; aud?: string; exp?: string } = {}, key = privateKey) {
  return new SignJWT({ sid: 'privy-session' })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(claims.iss ?? 'privy.io')
    .setAudience(claims.aud ?? appId)
    .setSubject('did:privy:alice')
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '1h')
    .sign(key)
}

function linkedAccounts(accounts: object[]) {
  return vi.fn(async (_url: string, _init?: RequestInit) =>
    Response.json({ linked_accounts: accounts }),
  )
}

describe('privy client', () => {
  it('accepts a token signed with the app key', async () => {
    const privy = createPrivy({ appId, verificationKey: pem })
    expect(await privy.verifyAccessToken(await accessToken())).toEqual({
      privyId: 'did:privy:alice',
    })
  })

  it('reads a one-line PEM with escaped newlines from .env', async () => {
    const privy = createPrivy({ appId, verificationKey: pem.trim().replace(/\n/g, '\\n') })
    await expect(privy.verifyAccessToken(await accessToken())).resolves.toBeTruthy()
  })

  it.each([
    ['another app', { aud: 'other-app' }],
    ['another issuer', { iss: 'evil.io' }],
    ['an expired token', { exp: '-1m' }],
  ])('rejects a token for %s', async (_, claims) => {
    const privy = createPrivy({ appId, verificationKey: pem })
    await expect(privy.verifyAccessToken(await accessToken(claims))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('rejects a token signed by another key', async () => {
    const other = await generateKeyPair('ES256')
    const privy = createPrivy({ appId, verificationKey: pem })
    await expect(
      privy.verifyAccessToken(await accessToken({}, other.privateKey)),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('answers 503 when Privy is not configured', async () => {
    const privy = createPrivy({})
    await expect(privy.verifyAccessToken('x')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PRIVY_NOT_CONFIGURED',
    })
  })

  it('picks the embedded Ethereum wallet, not an external one', async () => {
    const fetch = linkedAccounts([
      { type: 'email', address: 'a@b.c' },
      {
        type: 'wallet',
        chain_type: 'ethereum',
        wallet_client_type: 'metamask',
        address: '0x1111111111111111111111111111111111111111',
      },
      {
        type: 'wallet',
        chain_type: 'ethereum',
        wallet_client_type: 'privy',
        address: '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD',
      },
    ])
    const privy = createPrivy({
      appId,
      appSecret: 's3cret',
      fetch: fetch as typeof globalThis.fetch,
    })

    expect(await privy.getWalletAddress('did:privy:alice')).toBe(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    )
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://auth.privy.io/api/v1/users/did%3Aprivy%3Aalice')
    expect(init?.headers).toMatchObject({
      authorization: `Basic ${btoa('test-app:s3cret')}`,
      'privy-app-id': appId,
    })
  })

  it('returns null when the user has no embedded wallet yet', async () => {
    const fetch = linkedAccounts([])
    const privy = createPrivy({
      appId,
      appSecret: 's3cret',
      fetch: fetch as typeof globalThis.fetch,
    })
    expect(await privy.getWalletAddress('did:privy:alice')).toBeNull()
  })

  it('answers 502 when Privy is down', async () => {
    const fetch = vi.fn(async () => new Response('oops', { status: 500 }))
    const privy = createPrivy({ appId, appSecret: 's3cret', fetch })
    await expect(privy.getWalletAddress('did:privy:alice')).rejects.toMatchObject({
      statusCode: 502,
      code: 'PRIVY_UNAVAILABLE',
    })
  })
})
