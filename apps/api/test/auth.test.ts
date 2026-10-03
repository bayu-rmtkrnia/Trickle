import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import type { AuthChallenge, User } from '../src/generated/prisma/client.js'
import type { AuthRepository } from '../src/modules/auth/repository.js'
import { createAuthService } from '../src/modules/auth/service.js'

const env = {
  AUTH_CHALLENGE_TTL_SECONDS: 300,
  AUTH_DOMAIN: 'localhost:3000',
  CHAIN_ID: 10143,
  WEB_URL: 'http://localhost:3000',
}

/** In-memory stand-in for the Prisma-backed repository. */
function fakeRepo() {
  const challenges = new Map<string, AuthChallenge>()
  const users = new Map<string, User>()
  const repo = {
    async createChallenge(data) {
      const row = { id: data.nonce, ...data, usedAt: null, createdAt: new Date() } as AuthChallenge
      challenges.set(data.nonce, row)
      return row
    },
    async findChallenge(nonce) {
      return challenges.get(nonce) ?? null
    },
    async burnChallenge(nonce) {
      const c = challenges.get(nonce)
      if (!c || c.usedAt) return false
      c.usedAt = new Date()
      return true
    },
    async upsertUserOnLogin(address) {
      const user =
        users.get(address) ??
        ({
          id: `user-${users.size + 1}`,
          address,
          displayName: null,
          createdAt: new Date(),
        } as User)
      users.set(address, user)
      return user
    },
    async findUserWithRoleCounts() {
      return null
    },
  } as AuthRepository
  return { repo, challenges }
}

const account = privateKeyToAccount(keccak256(toHex('test:auth-service')))
const address = account.address.toLowerCase() as `0x${string}`

function setup() {
  const { repo, challenges } = fakeRepo()
  const service = createAuthService({ repo, env, signToken: async (s) => `token:${s.sub}` })
  return { service, challenges }
}

describe('auth service', () => {
  it('signs in with a valid signature and burns the nonce', async () => {
    const { service } = setup()
    const { message } = await service.createChallenge(address)
    const signature = await account.signMessage({ message })

    const res = await service.verify(message, signature)
    expect(res).toMatchObject({ token: 'token:user-1', user: { address } })

    await expect(service.verify(message, signature)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a signature from another account', async () => {
    const { service } = setup()
    const { message } = await service.createChallenge(address)
    const other = privateKeyToAccount(keccak256(toHex('test:someone-else')))

    await expect(
      service.verify(message, await other.signMessage({ message })),
    ).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an expired challenge', async () => {
    const { service, challenges } = setup()
    const { nonce, message } = await service.createChallenge(address)
    challenges.get(nonce)!.expiresAt = new Date(Date.now() - 1000)

    await expect(
      service.verify(message, await account.signMessage({ message })),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Sign-in request expired' })
  })

  it('rejects a malformed message with 400', async () => {
    const { service } = setup()
    await expect(service.verify('hello', '0x00')).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_MESSAGE',
    })
  })

  it('returns 401 from me() when the account is gone', async () => {
    const { service } = setup()
    await expect(service.me('missing')).rejects.toMatchObject({ statusCode: 401 })
  })
})
