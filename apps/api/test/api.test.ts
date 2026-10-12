import { keccak256, toHex, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'
import { unauthorized } from '../src/lib/errors.js'
import type { Privy } from '../src/lib/privy.js'
import type { StreamReader } from '../src/lib/streams.js'
import type { Chain } from '../src/lib/chain.js'
import type { DemoSigner } from '../src/lib/demo.js'
import { createPrisma } from '../src/lib/prisma.js'
import { expectForbidden } from './helpers.js'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('api (integration)', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    GAS_DRIP_DAILY_LIMIT: '3',
    DEMO_STREAM_IP_DAILY_LIMIT: '2',
  })
  const db = createPrisma(env.DATABASE_URL)
  const sendNative = vi.fn<Chain['sendNative']>()
  const chain: Chain = {
    treasuryAddress: '0x000000000000000000000000000000000000dEaD',
    getBalance: async () => 10n ** 18n,
    sendNative,
  }
  const fx = { usdIdr: vi.fn() }
  const hasActiveStream = vi.fn<StreamReader['hasActiveStream']>()
  const splitOf = vi.fn<StreamReader['splitOf']>()
  const streams: StreamReader = { verified: true, hasActiveStream, splitOf }
  const createStream = vi.fn<DemoSigner['createStream']>()
  const demo: DemoSigner = {
    employerAddress: '0x000000000000000000000000000000000000bEEF',
    getGasBalance: async () => 10n ** 18n,
    createStream,
  }
  const noSplit = { recipient: '0x0000000000000000000000000000000000000000', bps: 0 } as const
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

  async function createCompany(token: string, name = 'PT Maju Jaya') {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/companies',
      headers: as(token),
      payload: { name },
    })
    expect(res.statusCode).toBe(201)
    return res.json().id as string
  }

  // Generous timeout: the first buildApp pays for cold imports, which can pass 10s
  // when every test file starts at once.
  beforeAll(async () => {
    app = await buildApp({ env, db, chain, fx, privy, streams, demo, rateLimit: false })
  }, 30_000)

  beforeEach(async () => {
    sendNative.mockReset()
    createStream.mockReset().mockImplementation(async (_worker, _amount, seconds) => {
      const start = Math.floor(Date.now() / 1000)
      return { streamId: 1n, txHash: `0x${'aa'.repeat(32)}`, start, end: start + seconds }
    })
    hasActiveStream.mockReset().mockResolvedValue(false)
    splitOf.mockReset().mockResolvedValue(noSplit)
    await db.$executeRawUnsafe(
      'TRUNCATE "Payout","DemoStream","GasDrip","Invite","Recipient","Worker","Company","Session","User" CASCADE',
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

  describe('employer → worker → recipient invite flow', () => {
    it('links a worker and a recipient through invites', async () => {
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
        url: '/api/v1/companies',
        headers: as(employer.token),
        payload: { name: 'PT Maju Jaya', country: 'my' },
      })
      expect(created.statusCode).toBe(201)
      expect(created.json().country).toBe('MY')
      const companyId = created.json().id

      const dup = await app.inject({
        method: 'POST',
        url: '/api/v1/companies',
        headers: as(employer.token),
        payload: { name: 'Another' },
      })
      expect(dup.statusCode).toBe(409)
      expect(dup.json().error.code).toBe('COMPANY_EXISTS')

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
        url: `/api/v1/invites/${invite.code}/acceptance`,
        headers: as(employer.token),
      })
      expect(own.json().error.code).toBe('CANNOT_ACCEPT_OWN_INVITE')

      const accepted = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${invite.code}/acceptance`,
        headers: as(worker.token),
      })
      expect(accepted.statusCode).toBe(201)
      expect(accepted.json().status).toBe('ACCEPTED')

      const again = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${invite.code}/acceptance`,
        headers: as(family.token),
      })
      expect(again.statusCode).toBe(409)

      const workers = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${companyId}/workers`,
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
          payload: { type: 'RECIPIENT', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
        })
      ).json()
      expect(famInvite.invitedBy.name).toBe('Siti')

      await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${famInvite.code}/acceptance`,
        headers: as(family.token),
      })
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(family.token),
      })
      expect(me.json().roles).toEqual({ employer: false, worker: false, recipient: true })
    })

    it('does not let non-workers invite recipients', async () => {
      const stranger = await signIn('stranger')
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invites',
        headers: as(stranger.token),
        payload: { type: 'RECIPIENT', inviteeName: 'Ibu' },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('invite cancellation', () => {
    async function invite(token: string, payload: object) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invites',
        headers: as(token),
        payload,
      })
      expect(res.statusCode).toBe(201)
      return res.json() as { id: string; code: string }
    }

    it('lets the creator cancel a pending invite; the link stops working', async () => {
      const boss = await signIn('employer')
      await createCompany(boss.token)
      const { id, code } = await invite(boss.token, {
        type: 'WORKER',
        inviteeName: 'Siti',
        monthlySalaryUsd: 1200,
      })

      const del = () =>
        app.inject({ method: 'DELETE', url: `/api/v1/invites/${id}`, headers: as(boss.token) })
      expect((await del()).statusCode).toBe(204)
      expect((await del()).statusCode).toBe(204)

      const view = await app.inject({ method: 'GET', url: `/api/v1/invites/${code}` })
      expect(view.json().status).toBe('REVOKED')
      const siti = await signIn('siti')
      const accept = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(siti.token),
      })
      expect(accept.statusCode).toBe(409)
      expect(accept.json().error.code).toBe('INVITE_REVOKED')

      const unknown = await app.inject({
        method: 'DELETE',
        url: '/api/v1/invites/does-not-exist',
        headers: as(boss.token),
      })
      expect(unknown.statusCode).toBe(404)
    })

    it('refuses to cancel an invite that was already accepted', async () => {
      const boss = await signIn('employer')
      await createCompany(boss.token)
      const { id, code } = await invite(boss.token, {
        type: 'WORKER',
        inviteeName: 'Siti',
        monthlySalaryUsd: 1200,
      })
      const siti = await signIn('siti')
      await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(siti.token),
      })

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/invites/${id}`,
        headers: as(boss.token),
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().error.code).toBe('INVITE_ALREADY_ACCEPTED')

      // The worker can now invite and cancel their own recipient invite.
      const fam = await invite(siti.token, { type: 'RECIPIENT', inviteeName: 'Ibu' })
      const own = await app.inject({
        method: 'DELETE',
        url: `/api/v1/invites/${fam.id}`,
        headers: as(siti.token),
      })
      expect(own.statusCode).toBe(204)
    })

    it('answers 403 to everyone but the creator', async () => {
      const boss = await signIn('employer')
      await createCompany(boss.token)
      const { code } = await invite(boss.token, {
        type: 'WORKER',
        inviteeName: 'Siti',
        monthlySalaryUsd: 1200,
      })
      const siti = await signIn('siti')
      await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(siti.token),
      })
      const pending = await invite(boss.token, {
        type: 'WORKER',
        inviteeName: 'Budi',
        monthlySalaryUsd: 900,
      })
      const rival = await signIn('rival')
      await createCompany(rival.token, 'PT Saingan')
      const outsider = await signIn('outsider')

      const cancel = [{ method: 'DELETE', url: `/api/v1/invites/${pending.id}` }] as const
      await expectForbidden(app, rival.token, [...cancel])
      // Siti is a worker (an inviter role) but did not create it.
      await expectForbidden(app, siti.token, [...cancel])
      await expectForbidden(app, outsider.token, [
        ...cancel,
        { method: 'GET', url: '/api/v1/invites' },
        {
          method: 'POST',
          url: '/api/v1/invites',
          payload: { type: 'RECIPIENT', inviteeName: 'Ibu' },
        },
      ])
    })
  })

  describe('companies', () => {
    const at = (id: string) =>
      [
        { method: 'GET', url: `/api/v1/companies/${id}` },
        { method: 'PATCH', url: `/api/v1/companies/${id}`, payload: { name: 'Hijacked' } },
        { method: 'DELETE', url: `/api/v1/companies/${id}` },
        { method: 'GET', url: `/api/v1/companies/${id}/workers` },
      ] as const

    it('lets the owner read, update and list workers', async () => {
      const owner = await signIn('employer')
      const id = await createCompany(owner.token)

      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(owner.token),
      })
      expect(me.json()).toMatchObject({ companyId: id, roles: { employer: true } })

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
        payload: { name: 'PT Maju Jaya Sdn Bhd' },
      })
      expect(patched.statusCode).toBe(200)
      expect(patched.json().name).toBe('PT Maju Jaya Sdn Bhd')

      const got = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(got.json()).toMatchObject({ id, name: 'PT Maju Jaya Sdn Bhd' })
    })

    it('answers 403 to non-employers and to other employers', async () => {
      const owner = await signIn('employer')
      const rival = await signIn('rival')
      const outsider = await signIn('outsider')
      const id = await createCompany(owner.token)
      await createCompany(rival.token, 'PT Saingan')

      // Wrong role, then wrong owner. Each request runs alone, so DELETE does not
      // remove the company for the next one.
      await expectForbidden(app, outsider.token, [...at(id)])
      await expectForbidden(app, rival.token, [...at(id)])

      const still = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(still.json().name).toBe('PT Maju Jaya')
    })

    it('answers 404 for an unknown company', async () => {
      const owner = await signIn('employer')
      await createCompany(owner.token)
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/companies/does-not-exist',
        headers: as(owner.token),
      })
      expect(res.statusCode).toBe(404)
      expect(res.json().error.code).toBe('COMPANY_NOT_FOUND')
    })

    it('soft-deletes: revokes pending invites, drops the role, allows a new company', async () => {
      const owner = await signIn('employer')
      const id = await createCompany(owner.token)
      const invite = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(owner.token),
          payload: { type: 'WORKER', inviteeName: 'Siti', monthlySalaryUsd: 1000 },
        })
      ).json()

      const del = await app.inject({
        method: 'DELETE',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(del.statusCode).toBe(204)

      // The row is kept for history, but the API treats it as gone.
      expect(await db.company.findUnique({ where: { id } })).toMatchObject({
        deletedAt: expect.any(Date),
      })
      const view = await app.inject({ method: 'GET', url: `/api/v1/invites/${invite.code}` })
      expect(view.json().status).toBe('REVOKED')

      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(owner.token),
      })
      expect(me.json()).toMatchObject({ companyId: null, roles: { employer: false } })
      // No longer an employer, so the role check answers before the 404.
      const gone = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(gone.statusCode).toBe(403)

      const fresh = await createCompany(owner.token, 'PT Kedua')
      expect(fresh).not.toBe(id)
      const old = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(old.statusCode).toBe(404)
    })

    it('refuses to delete a company that still has workers', async () => {
      const owner = await signIn('employer')
      const worker = await signIn('worker')
      const id = await createCompany(owner.token)
      const { code } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(owner.token),
          payload: { type: 'WORKER', inviteeName: 'Siti', monthlySalaryUsd: 1000 },
        })
      ).json()
      await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(worker.token),
      })

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/companies/${id}`,
        headers: as(owner.token),
      })
      expect(res.statusCode).toBe(409)
      expect(res.json().error.code).toBe('COMPANY_HAS_WORKERS')
    })
  })

  describe('workers', () => {
    /** Employer with a company and one worker added by address. */
    async function hire() {
      const boss = await signIn('employer')
      const companyId = await createCompany(boss.token)
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/companies/${companyId}/workers`,
        headers: as(boss.token),
        payload: {
          address: account('siti').address,
          displayName: 'Siti',
          position: 'Caregiver',
          monthlySalaryUsd: 1200,
        },
      })
      expect(res.statusCode).toBe(201)
      return { boss, companyId, workerId: res.json().id as string }
    }

    it('adds a worker by address; their account links on first sign-in', async () => {
      const { boss, companyId, workerId } = await hire()

      const list = await app.inject({
        method: 'GET',
        url: `/api/v1/companies/${companyId}/workers`,
        headers: as(boss.token),
      })
      expect(list.json().data).toEqual([
        expect.objectContaining({
          id: workerId,
          companyId,
          address: account('siti').address.toLowerCase(),
          position: 'Caregiver',
          monthlySalaryUsd: 1200,
        }),
      ])

      // Siti signs in with Privy later and is already a worker.
      const siti = await signIn('siti')
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(siti.token),
      })
      expect(me.json().roles).toMatchObject({ worker: true })

      const dup = await app.inject({
        method: 'POST',
        url: `/api/v1/companies/${companyId}/workers`,
        headers: as(boss.token),
        payload: { address: account('siti').address, displayName: 'Siti', monthlySalaryUsd: 1 },
      })
      expect(dup.json().error.code).toBe('WORKER_EXISTS')
    })

    it('lets the employer update and the worker only read themself', async () => {
      const { boss, workerId } = await hire()
      const siti = await signIn('siti')

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/workers/${workerId}`,
        headers: as(boss.token),
        payload: { position: 'Head caregiver', monthlySalaryUsd: 1500 },
      })
      expect(patched.json()).toMatchObject({ position: 'Head caregiver', monthlySalaryUsd: 1500 })

      const self = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/${workerId}`,
        headers: as(siti.token),
      })
      expect(self.statusCode).toBe(200)

      await expectForbidden(app, siti.token, [
        { method: 'PATCH', url: `/api/v1/workers/${workerId}`, payload: { displayName: 'Boss' } },
        { method: 'DELETE', url: `/api/v1/workers/${workerId}` },
      ])
    })

    it('answers 403 to other employers, other workers and family', async () => {
      const { companyId, workerId } = await hire()
      const rival = await signIn('rival')
      const rivalCompany = await createCompany(rival.token, 'PT Saingan')
      // Another worker, at the rival company.
      await app.inject({
        method: 'POST',
        url: `/api/v1/companies/${rivalCompany}/workers`,
        headers: as(rival.token),
        payload: { address: account('budi').address, displayName: 'Budi', monthlySalaryUsd: 900 },
      })
      const budi = await signIn('budi')
      const outsider = await signIn('outsider')

      const all = [
        { method: 'GET', url: `/api/v1/workers/${workerId}` },
        { method: 'PATCH', url: `/api/v1/workers/${workerId}`, payload: { displayName: 'X' } },
        { method: 'DELETE', url: `/api/v1/workers/${workerId}` },
        { method: 'GET', url: `/api/v1/companies/${companyId}/workers` },
        {
          method: 'POST',
          url: `/api/v1/companies/${companyId}/workers`,
          payload: { address: account('x').address, displayName: 'X', monthlySalaryUsd: 1 },
        },
      ] as const
      await expectForbidden(app, rival.token, [...all])
      await expectForbidden(app, budi.token, [...all])
      await expectForbidden(app, outsider.token, [...all])
    })

    it('refuses to remove a worker while their stream is active', async () => {
      const { boss, companyId, workerId } = await hire()
      hasActiveStream.mockResolvedValueOnce(true)

      const blocked = await app.inject({
        method: 'DELETE',
        url: `/api/v1/workers/${workerId}`,
        headers: as(boss.token),
      })
      expect(blocked.statusCode).toBe(409)
      expect(blocked.json().error.code).toBe('STREAM_ACTIVE')
      expect(hasActiveStream).toHaveBeenCalledWith(
        boss.address.toLowerCase(),
        account('siti').address.toLowerCase(),
      )

      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/workers/${workerId}`,
        headers: as(boss.token),
      })
      expect(removed.statusCode).toBe(204)

      const gone = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/${workerId}`,
        headers: as(boss.token),
      })
      expect(gone.statusCode).toBe(404)
      const siti = await signIn('siti')
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(siti.token),
      })
      expect(me.json().roles.worker).toBe(false)

      // With no workers left, the company can be deleted.
      const del = await app.inject({
        method: 'DELETE',
        url: `/api/v1/companies/${companyId}`,
        headers: as(boss.token),
      })
      expect(del.statusCode).toBe(204)
    })

    it('restores a removed worker who accepts a new invite', async () => {
      const { boss, workerId } = await hire()
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/workers/${workerId}`,
        headers: as(boss.token),
      })
      const { code } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(boss.token),
          payload: { type: 'WORKER', inviteeName: 'Siti R.', monthlySalaryUsd: 1300 },
        })
      ).json()
      const siti = await signIn('siti')
      const accepted = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(siti.token),
      })
      expect(accepted.statusCode).toBe(201)

      const back = await app.inject({
        method: 'GET',
        url: `/api/v1/workers/${workerId}`,
        headers: as(siti.token),
      })
      expect(back.json()).toMatchObject({
        id: workerId,
        displayName: 'Siti R.',
        monthlySalaryUsd: 1300,
      })
    })
  })

  describe('recipients', () => {
    /** A worker (hired by address) who adds Ibu as a recipient by address. */
    async function addIbu() {
      const boss = await signIn('employer')
      const companyId = await createCompany(boss.token)
      await app.inject({
        method: 'POST',
        url: `/api/v1/companies/${companyId}/workers`,
        headers: as(boss.token),
        payload: { address: account('siti').address, displayName: 'Siti', monthlySalaryUsd: 1200 },
      })
      const siti = await signIn('siti')
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/recipients',
        headers: as(siti.token),
        payload: { address: account('ibu').address, displayName: 'Ibu Aminah', relation: 'Ibu' },
      })
      expect(res.statusCode).toBe(201)
      return { boss, siti, recipientId: res.json().id as string }
    }

    it('lets a worker add, list and update recipients; the recipient links on sign-in', async () => {
      const { siti, recipientId } = await addIbu()

      const list = await app.inject({
        method: 'GET',
        url: '/api/v1/recipients',
        headers: as(siti.token),
      })
      expect(list.json()).toEqual({
        data: [
          expect.objectContaining({
            id: recipientId,
            address: account('ibu').address.toLowerCase(),
            relation: 'Ibu',
          }),
        ],
        nextCursor: null,
      })

      const patched = await app.inject({
        method: 'PATCH',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(siti.token),
        payload: { displayName: 'Mama', relation: null },
      })
      expect(patched.json()).toMatchObject({ displayName: 'Mama', relation: null })

      const ibu = await signIn('ibu')
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(ibu.token),
      })
      expect(me.json().roles).toEqual({ employer: false, worker: false, recipient: true })
      const self = await app.inject({
        method: 'GET',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(ibu.token),
      })
      expect(self.statusCode).toBe(200)

      const dup = await app.inject({
        method: 'POST',
        url: '/api/v1/recipients',
        headers: as(siti.token),
        payload: { address: account('ibu').address, displayName: 'Ibu' },
      })
      expect(dup.json().error.code).toBe('RECIPIENT_EXISTS')
      const selfAdd = await app.inject({
        method: 'POST',
        url: '/api/v1/recipients',
        headers: as(siti.token),
        payload: { address: siti.address, displayName: 'Me' },
      })
      expect(selfAdd.json().error.code).toBe('CANNOT_ADD_SELF')
    })

    it('answers 403 to employers, other workers, the recipient (for writes) and outsiders', async () => {
      const { boss, recipientId } = await addIbu()
      const ibu = await signIn('ibu')
      const rival = await signIn('rival')
      const rivalCompany = await createCompany(rival.token, 'PT Saingan')
      await app.inject({
        method: 'POST',
        url: `/api/v1/companies/${rivalCompany}/workers`,
        headers: as(rival.token),
        payload: { address: account('budi').address, displayName: 'Budi', monthlySalaryUsd: 900 },
      })
      const budi = await signIn('budi')
      const outsider = await signIn('outsider')

      const one = [
        { method: 'GET', url: `/api/v1/recipients/${recipientId}` },
        {
          method: 'PATCH',
          url: `/api/v1/recipients/${recipientId}`,
          payload: { displayName: 'X' },
        },
        { method: 'DELETE', url: `/api/v1/recipients/${recipientId}` },
      ] as const
      const collection = [
        { method: 'GET', url: '/api/v1/recipients' },
        {
          method: 'POST',
          url: '/api/v1/recipients',
          payload: { address: account('x').address, displayName: 'X' },
        },
      ] as const
      await expectForbidden(app, boss.token, [...one, ...collection])
      await expectForbidden(app, budi.token, [...one])
      await expectForbidden(app, outsider.token, [...one, ...collection])
      await expectForbidden(app, ibu.token, [...one.slice(1), ...collection])

      // Budi is a worker, so his own (empty) list is fine and does not leak Siti's.
      const budiList = await app.inject({
        method: 'GET',
        url: '/api/v1/recipients',
        headers: as(budi.token),
      })
      expect(budiList.json().data).toEqual([])
    })

    it('refuses to remove a recipient the on-chain split still pays', async () => {
      const { siti, recipientId } = await addIbu()
      splitOf.mockResolvedValueOnce({
        recipient: account('ibu').address.toLowerCase() as Address,
        bps: 3000,
      })

      const blocked = await app.inject({
        method: 'DELETE',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(siti.token),
      })
      expect(blocked.statusCode).toBe(409)
      expect(blocked.json().error.code).toBe('SPLIT_ACTIVE')
      expect(splitOf).toHaveBeenCalledWith(siti.address.toLowerCase())

      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(siti.token),
      })
      expect(removed.statusCode).toBe(204)
      const ibu = await signIn('ibu')
      const me = await app.inject({
        method: 'GET',
        url: '/api/v1/users/me',
        headers: as(ibu.token),
      })
      expect(me.json().roles.recipient).toBe(false)
    })

    it('restores a removed recipient who accepts a new family invite', async () => {
      const { siti, recipientId } = await addIbu()
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(siti.token),
      })
      const { code } = (
        await app.inject({
          method: 'POST',
          url: '/api/v1/invites',
          headers: as(siti.token),
          payload: { type: 'RECIPIENT', inviteeName: 'Ibu A.', relation: 'Ibu' },
        })
      ).json()
      const ibu = await signIn('ibu')
      const accepted = await app.inject({
        method: 'POST',
        url: `/api/v1/invites/${code}/acceptance`,
        headers: as(ibu.token),
      })
      expect(accepted.statusCode).toBe(201)

      const back = await app.inject({
        method: 'GET',
        url: `/api/v1/recipients/${recipientId}`,
        headers: as(siti.token),
      })
      expect(back.json()).toMatchObject({ id: recipientId, displayName: 'Ibu A.' })
    })
  })

  describe('pagination', () => {
    it('pages through invites newest first without gaps or repeats', async () => {
      const employer = await signIn('employer')
      await createCompany(employer.token)
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
      await createCompany(user.token)
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

  describe('judge mode', () => {
    const start = (token?: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/demo-streams',
        headers: token ? as(token) : {},
      })

    it('streams to a brand-new account once, and replays afterwards', async () => {
      expect((await start()).statusCode).toBe(401)

      // A judge has no company, job or recipient yet: no role is needed.
      const judge = await signIn('judge')
      const first = await start(judge.token)
      expect(first.statusCode).toBe(201)
      expect(first.json()).toMatchObject({
        workerAddress: judge.address.toLowerCase(),
        amountUsd: '50',
        durationSeconds: 3600,
        status: 'SENT',
        streamId: '1',
        alreadyStarted: false,
      })
      expect(createStream).toHaveBeenCalledWith(judge.address.toLowerCase(), 50_000_000n, 3600)

      const again = await start(judge.token)
      expect(again.statusCode).toBe(200)
      expect(again.json()).toMatchObject({ id: first.json().id, alreadyStarted: true })
      expect(createStream).toHaveBeenCalledTimes(1)
    })

    it('lets a failed attempt be retried', async () => {
      const judge = await signIn('judge')
      createStream.mockRejectedValueOnce(new Error('execution reverted'))
      const failed = await start(judge.token)
      expect(failed.statusCode).toBe(502)
      expect(failed.json().error.code).toBe('DEMO_STREAM_FAILED')

      expect((await start(judge.token)).statusCode).toBe(201)
      expect(createStream).toHaveBeenCalledTimes(2)
    })

    it('caps demo streams per IP', async () => {
      for (const name of ['judge-a', 'judge-b']) {
        const u = await signIn(name)
        expect((await start(u.token)).statusCode).toBe(201)
      }
      const third = await signIn('judge-c')
      const res = await start(third.token)
      expect(res.statusCode).toBe(429)
      expect(res.json().error.code).toBe('DEMO_IP_LIMIT')
      expect(createStream).toHaveBeenCalledTimes(2)
    })

    it('reports usage for monitoring', async () => {
      const judge = await signIn('judge')
      await start(judge.token)
      const res = await app.inject({ method: 'GET', url: '/api/v1/demo-streams/status' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        configured: true,
        employerGasMon: '1',
        streamsLast24h: 1,
      })
    })
  })
})
