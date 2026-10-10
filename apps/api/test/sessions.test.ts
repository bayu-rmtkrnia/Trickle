import { describe, expect, it } from 'vitest'
import type { Session, User } from '../src/generated/prisma/client.js'
import { unauthorized } from '../src/lib/errors.js'
import type { Privy } from '../src/lib/privy.js'
import { hashToken } from '../src/lib/tokens.js'
import type { SessionRepository } from '../src/modules/sessions/repository.js'
import { createSessionService } from '../src/modules/sessions/service.js'

const wallet = '0x66818500d7c295d61d613c55269089e0c3d73fcf'

/** In-memory stand-in for the Prisma-backed repository. */
function fakeRepo() {
  const users = new Map<string, User>()
  const sessions: Session[] = []
  const repo = {
    async findUserByPrivyId(privyId) {
      return [...users.values()].find((u) => u.privyId === privyId) ?? null
    },
    async recordLogin(userId) {
      const user = users.get(userId)!
      user.lastLoginAt = new Date()
      return user
    },
    async linkPrivyUser(privyId, address) {
      const existing = [...users.values()].find((u) => u.address === address)
      const user =
        existing ??
        ({
          id: `user-${users.size + 1}`,
          address,
          displayName: null,
          createdAt: new Date(),
        } as User)
      user.privyId = privyId
      users.set(user.id, user)
      return user
    },
    async create(data) {
      const row = {
        id: `s-${sessions.length + 1}`,
        revokedAt: null,
        createdAt: new Date(),
        ...data,
      }
      sessions.push(row)
      return row
    },
  } as SessionRepository
  return { repo, users, sessions }
}

/** Accepts `privy:<name>` as the access token of `did:privy:<name>`. */
function fakePrivy(wallets: Record<string, `0x${string}` | null> = {}) {
  let walletLookups = 0
  const privy: Privy = {
    async verifyAccessToken(token) {
      if (!token.startsWith('privy:')) throw unauthorized('bad token')
      return { privyId: `did:privy:${token.slice(6)}` }
    },
    async getWalletAddress(privyId) {
      walletLookups++
      return privyId in wallets ? (wallets[privyId] ?? null) : wallet
    },
  }
  return { privy, lookups: () => walletLookups }
}

function setup(wallets?: Record<string, `0x${string}` | null>) {
  const { repo, users, sessions } = fakeRepo()
  const { privy, lookups } = fakePrivy(wallets)
  const service = createSessionService({ repo, privy, env: { SESSION_TTL_DAYS: 7 } })
  return { service, users, sessions, lookups }
}

describe('session service', () => {
  it('creates a user on first sign-in and stores only the token hash', async () => {
    const { service, sessions } = setup()
    const res = await service.create('privy:alice')

    expect(res.user).toMatchObject({ id: 'user-1', address: wallet })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.tokenHash).toBe(hashToken(res.token))
    expect(sessions[0]!.tokenHash).not.toBe(res.token)
    const days = (new Date(res.expiresAt).getTime() - Date.now()) / 86_400_000
    expect(days).toBeCloseTo(7, 1)
  })

  it('skips the wallet lookup for a returning user', async () => {
    const { service, lookups } = setup()
    const first = await service.create('privy:alice')
    const second = await service.create('privy:alice')

    expect(second.user.id).toBe(first.user.id)
    expect(second.token).not.toBe(first.token)
    expect(lookups()).toBe(1)
  })

  it('links a pre-Privy account that owns the same wallet', async () => {
    const { service, users } = setup()
    users.set('legacy', {
      id: 'legacy',
      address: wallet,
      privyId: null,
      displayName: 'Siti',
      createdAt: new Date(),
      lastLoginAt: null,
    })
    const res = await service.create('privy:siti')
    expect(res.user).toMatchObject({ id: 'legacy', displayName: 'Siti' })
    expect(users.get('legacy')!.privyId).toBe('did:privy:siti')
  })

  it('answers 409 while the embedded wallet does not exist yet', async () => {
    const { service, sessions } = setup({ 'did:privy:fresh': null })
    await expect(service.create('privy:fresh')).rejects.toMatchObject({
      statusCode: 409,
      code: 'WALLET_NOT_READY',
    })
    expect(sessions).toHaveLength(0)
  })

  it('rejects an invalid access token with 401', async () => {
    const { service } = setup()
    await expect(service.create('forged')).rejects.toMatchObject({ statusCode: 401 })
  })
})
