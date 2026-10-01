import { keccak256, toHex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'
import type { Chain } from '../src/lib/chain.js'
import { createPrisma } from '../src/lib/prisma.js'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('api (integration)', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_SECRET: 'test-secret-test-secret-test-secret',
    GAS_DRIP_DAILY_LIMIT: '3',
  })
  const db = createPrisma(env.DATABASE_URL)
  const sendNative = vi.fn<Chain['sendNative']>()
  const chain: Chain = {
    treasuryAddress: '0x000000000000000000000000000000000000dEaD',
    getBalance: async () => 10n ** 18n,
    sendNative,
  }
  const fx = { usdIdr: vi.fn() }
  let app: Awaited<ReturnType<typeof buildApp>>

  const account = (name: string) => privateKeyToAccount(keccak256(toHex(`test:${name}`)))

  async function signIn(name: string) {
    const acct = account(name)
    const challenge = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/challenge',
      payload: { address: acct.address },
    })
    expect(challenge.statusCode).toBe(201)
    const { message } = challenge.json()
    const signature = await acct.signMessage({ message })
    const verify = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify',
      payload: { message, signature },
    })
    expect(verify.statusCode).toBe(200)
    return { token: verify.json().token as string, address: acct.address }
  }

  const as = (token: string) => ({ authorization: `Bearer ${token}` })

  beforeAll(async () => {
    app = await buildApp({ env, db, chain, fx, rateLimit: false })
  })

  beforeEach(async () => {
    sendNative.mockReset()
    await db.$executeRawUnsafe(
      'TRUNCATE "Payout","GasDrip","Invite","FamilyLink","EmployerWorker","Employer","AuthChallenge","User" CASCADE',
    )
  })

  afterAll(async () => {
    await app?.close()
    await db.$disconnect()
  })

  it('keeps /health at the root for the deploy healthcheck', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok', db: 'ok' })
  })

  describe('auth', () => {
    it('signs in with a signed challenge and rejects replays', async () => {
      const acct = account('alice')
      const { message } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/challenge',
          payload: { address: acct.address },
        })
      ).json()
      const signature = await acct.signMessage({ message })

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: { message, signature },
      })
      expect(first.statusCode).toBe(200)
      expect(first.json().user.address).toBe(acct.address.toLowerCase())

      const replay = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: { message, signature },
      })
      expect(replay.statusCode).toBe(401)
    })

    it('rejects a signature from a different key', async () => {
      const acct = account('alice')
      const { message } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/auth/challenge',
          payload: { address: acct.address },
        })
      ).json()
      const signature = await account('mallory').signMessage({ message })
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify',
        payload: { message, signature },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('UNAUTHORIZED')
    })

    it('requires a session for protected routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: expect.any(String) },
      })
    })

    it('returns validation errors in the uniform format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/challenge',
        payload: { address: 'nope' },
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('employer → worker → family invite flow', () => {
    it('links a worker and a family member through invites', async () => {
      const employer = await signIn('employer')
      const worker = await signIn('worker')
      const family = await signIn('family')

      // Worker invites need a company profile.
      const early = await app.inject({
        method: 'POST',
        url: '/api/v1/invites',
        headers: as(employer.token),
        payload: { type: 'WORKER', inviteeName: 'Siti', monthlySalaryUsd: 1200 },
      })
      expect(early.statusCode).toBe(403)

      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/employers',
        headers: as(employer.token),
        payload: { name: 'PT Maju Jaya', country: 'my' },
      })
      expect(created.statusCode).toBe(201)
      expect(created.json().country).toBe('MY')

      const dup = await app.inject({
        method: 'POST',
        url: '/api/v1/employers',
        headers: as(employer.token),
        payload: { name: 'Another' },
      })
      expect(dup.json().error.code).toBe('EMPLOYER_EXISTS')

      const invite = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(employer.token),
          payload: { type: 'WORKER', inviteeName: 'Siti', monthlySalaryUsd: 1200.5 },
        })
      ).json()
      expect(invite).toMatchObject({ type: 'WORKER', status: 'PENDING', monthlySalaryUsd: 1200.5 })
      expect(invite.url).toContain(`/w/invite/${invite.code}`)

      const publicView = await app.inject({ method: 'GET', url: `/api/v1/invites/${invite.code}` })
      expect(publicView.json().invitedBy.name).toBe('PT Maju Jaya')

      const own = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${invite.code}/accept`,
        headers: as(employer.token),
      })
      expect(own.json().error.code).toBe('CANNOT_ACCEPT_OWN_INVITE')

      const accepted = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${invite.code}/accept`,
        headers: as(worker.token),
      })
      expect(accepted.statusCode).toBe(200)
      expect(accepted.json().status).toBe('ACCEPTED')

      const again = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${invite.code}/accept`,
        headers: as(family.token),
      })
      expect(again.statusCode).toBe(409)

      const workers = await app.inject({
        method: 'GET',
        url: '/api/v1/employers/me/workers',
        headers: as(employer.token),
      })
      expect(workers.json().workers).toEqual([
        expect.objectContaining({ displayName: 'Siti', address: worker.address.toLowerCase() }),
      ])

      const famInvite = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(worker.token),
          payload: { type: 'FAMILY', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
        })
      ).json()
      expect(famInvite.invitedBy.name).toBe('Siti')

      await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${famInvite.code}/accept`,
        headers: as(family.token),
      })
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: as(family.token),
      })
      expect(me.json().roles).toEqual({ employer: false, worker: false, family: true })
    })

    it('does not let non-workers invite family', async () => {
      const stranger = await signIn('stranger')
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invites',
        headers: as(stranger.token),
        payload: { type: 'FAMILY', inviteeName: 'Ibu' },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('gas drip', () => {
    it('funds an address once and is idempotent afterwards', async () => {
      const user = await signIn('newbie')
      sendNative.mockResolvedValue(`0x${'ab'.repeat(32)}`)

      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/gas/drip',
        headers: as(user.token),
      })
      expect(first.statusCode).toBe(201)
      expect(first.json()).toMatchObject({ status: 'SENT', alreadyDripped: false })

      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/gas/drip',
        headers: as(user.token),
      })
      expect(second.statusCode).toBe(200)
      expect(second.json().alreadyDripped).toBe(true)
      expect(sendNative).toHaveBeenCalledTimes(1)
      expect(sendNative.mock.calls[0]?.[0]).toBe(user.address.toLowerCase() as Address)
    })

    it('marks a failed send so it can be retried', async () => {
      const user = await signIn('unlucky')
      sendNative.mockRejectedValueOnce(new Error('rpc down'))
      const failed = await app.inject({
        method: 'POST',
        url: '/api/v1/gas/drip',
        headers: as(user.token),
      })
      expect(failed.statusCode).toBe(502)
      expect(failed.json().error.code).toBe('DRIP_FAILED')

      sendNative.mockResolvedValueOnce(`0x${'cd'.repeat(32)}`)
      const retry = await app.inject({
        method: 'POST',
        url: '/api/v1/gas/drip',
        headers: as(user.token),
      })
      expect(retry.statusCode).toBe(201)
    })

    it('enforces the daily limit', async () => {
      sendNative.mockResolvedValue(`0x${'ef'.repeat(32)}`)
      for (const name of ['a', 'b', 'c']) {
        const u = await signIn(name)
        const r = await app.inject({
          method: 'POST',
          url: '/api/v1/gas/drip',
          headers: as(u.token),
        })
        expect(r.statusCode).toBe(201)
      }
      const late = await signIn('d')
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/gas/drip',
        headers: as(late.token),
      })
      expect(res.statusCode).toBe(429)
      expect(res.json().error.code).toBe('DRIP_DAILY_LIMIT')
    })
  })
})
