import { keccak256, toHex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'
import { unauthorized } from '../src/lib/errors.js'
import type { Privy } from '../src/lib/privy.js'
import type { Chain } from '../src/lib/chain.js'
import { createPrisma } from '../src/lib/prisma.js'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('api (integration)', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: url,
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

  /** Fake Privy: `privy:<name>` is a valid access token whose embedded wallet is account(name). */
  const privy: Privy = {
    async verifyAccessToken(token) {
      if (!token.startsWith('privy:')) throw unauthorized('Privy access token is invalid')
      return { privyId: `did:privy:${token.slice(6)}` }
    },
    async getWalletAddress(privyId) {
      return account(privyId.replace('did:privy:', '')).address.toLowerCase() as Address
    },
  }

  async function signIn(name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sessions',
      payload: { accessToken: `privy:${name}` },
    })
    expect(res.statusCode).toBe(201)
    return { token: res.json().token as string, address: account(name).address }
  }

  const as = (token: string) => ({ authorization: `Bearer ${token}` })

  beforeAll(async () => {
    app = await buildApp({ env, db, chain, fx, privy, rateLimit: false })
  })

  beforeEach(async () => {
    sendNative.mockReset()
    await db.$executeRawUnsafe(
      'TRUNCATE "Payout","GasDrip","Invite","FamilyLink","EmployerWorker","Employer","Session","User" CASCADE',
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

  describe('sessions and users', () => {
    it('signs in with a Privy token and signs out', async () => {
      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { accessToken: 'privy:alice' },
      })
      expect(first.statusCode).toBe(201)
      const { token, user } = first.json()
      expect(user.address).toBe(account('alice').address.toLowerCase())

      // Signing in again reuses the account but issues a separate session.
      const again = await signIn('alice')
      expect(again.token).not.toBe(token)

      const stored = await db.session.findMany({ where: { userId: user.id } })
      expect(stored).toHaveLength(2)
      expect(stored.map((s) => s.tokenHash)).not.toContain(token)

      const me = await app.inject({ method: 'GET', url: '/api/v1/users/me', headers: as(token) })
      expect(me.statusCode).toBe(200)
      expect(me.json()).toMatchObject({ id: user.id, roles: { employer: false } })

      const out = await app.inject({
        method: 'DELETE',
        url: '/api/v1/sessions/current',
        headers: as(token),
      })
      expect(out.statusCode).toBe(204)
      expect(out.body).toBe('')

      const after = await app.inject({ method: 'GET', url: '/api/v1/users/me', headers: as(token) })
      expect(after.statusCode).toBe(401)
      // Only the session that signed out is revoked.
      const other = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(again.token),
      })
      expect(other.statusCode).toBe(200)
    })

    it('rejects an invalid Privy token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/sessions',
        payload: { accessToken: 'forged' },
      })
      expect(res.statusCode).toBe(401)
      expect(res.json().error.code).toBe('UNAUTHORIZED')
    })

    it('rejects expired and unknown session tokens', async () => {
      const { token } = await signIn('alice')
      await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })

      for (const t of [token, 'not-a-session']) {
        const res = await app.inject({ method: 'GET', url: '/api/v1/users/me', headers: as(t) })
        expect(res.statusCode).toBe(401)
        expect(res.json()).toEqual({
          error: { code: 'UNAUTHORIZED', message: expect.any(String) },
        })
      }
    })

    it('updates my display name', async () => {
      const { token } = await signIn('alice')
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: as(token),
        payload: { displayName: '  Siti  ' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().displayName).toBe('Siti')

      const invalid = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: as(token),
        payload: { displayName: '' },
      })
      expect(invalid.statusCode).toBe(422)
      expect(invalid.json().error.code).toBe('VALIDATION_ERROR')
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
      expect(workers.json()).toEqual({
        data: [
          expect.objectContaining({ displayName: 'Siti', address: worker.address.toLowerCase() }),
        ],
        nextCursor: null,
      })

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
        url: '/api/v1/users/me',
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

  describe('pagination', () => {
    it('pages through invites newest first without gaps or repeats', async () => {
      const employer = await signIn('employer')
      await app.inject({
        method: 'POST',
        url: '/api/v1/employers',
        headers: as(employer.token),
        payload: { name: 'PT Maju Jaya' },
      })
      for (const name of ['A', 'B', 'C']) {
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(employer.token),
          payload: { type: 'WORKER', inviteeName: name, monthlySalaryUsd: 1000 },
        })
      }

      const first = await app.inject({
        method: 'GET',
        url: '/api/v1/invites?limit=2',
        headers: as(employer.token),
      })
      expect(first.statusCode).toBe(200)
      const page1 = first.json()
      expect(page1.data.map((i: { inviteeName: string }) => i.inviteeName)).toEqual(['C', 'B'])
      expect(page1.nextCursor).toEqual(expect.any(String))

      const second = await app.inject({
        method: 'GET',
        url: `/api/v1/invites?limit=2&cursor=${page1.nextCursor}`,
        headers: as(employer.token),
      })
      const page2 = second.json()
      expect(page2.data.map((i: { inviteeName: string }) => i.inviteeName)).toEqual(['A'])
      expect(page2.nextCursor).toBeNull()
    })

    it('rejects an out-of-range limit with 422', async () => {
      const user = await signIn('alice')
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/invites?limit=0',
        headers: as(user.token),
      })
      expect(res.statusCode).toBe(422)
      expect(res.json().error.details[0].field).toBe('querystring.limit')
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
