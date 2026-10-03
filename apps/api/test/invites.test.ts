import { describe, expect, it, vi } from 'vitest'
import type { InviteRepository, InviteWithRefs } from '../src/modules/invites/repository.js'
import { createInviteService } from '../src/modules/invites/service.js'

const env = { INVITE_TTL_DAYS: 14, WEB_URL: 'https://trickle.test' }

const invite = (over: Partial<InviteWithRefs> = {}): InviteWithRefs => ({
  id: 'inv-1',
  code: 'ABCDEF1234',
  type: 'WORKER',
  status: 'PENDING',
  createdById: 'employer-user',
  employerId: 'emp-1',
  inviteeName: 'Siti',
  monthlySalaryCents: 150_000,
  relation: null,
  acceptedById: null,
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date('2026-10-01T00:00:00Z'),
  createdBy: { address: '0xboss', displayName: null },
  employer: { name: 'Acme' },
  ...over,
})

/** Only the methods a test touches are filled in; the rest fail loudly. */
function service(repo: Partial<InviteRepository>) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createInviteService({
    env,
    repo: {
      findEmployerIdByOwner: unexpected,
      countEmployments: unexpected,
      create: unexpected,
      listByCreator: unexpected,
      findByCode: unexpected,
      accept: unexpected,
      ...repo,
    } as InviteRepository,
  })
}

describe('invite service: create', () => {
  it('forbids worker invites without a company profile', async () => {
    const s = service({ findEmployerIdByOwner: async () => null })
    await expect(
      s.create('u1', { type: 'WORKER', inviteeName: 'Siti', monthlySalaryUsd: 1500 }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('forbids family invites from users with no employer', async () => {
    const s = service({ countEmployments: async () => 0 })
    await expect(s.create('u1', { type: 'FAMILY', inviteeName: 'Ibu' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('stores the salary in cents and returns a shareable link', async () => {
    const create = vi.fn(async (data) =>
      invite({ ...data, monthlySalaryCents: data.monthlySalaryCents }),
    )
    const s = service({ findEmployerIdByOwner: async () => 'emp-1', create })

    const dto = await s.create('employer-user', {
      type: 'WORKER',
      inviteeName: 'Siti',
      monthlySalaryUsd: 1234.56,
    })

    expect(create.mock.calls[0]![0]).toMatchObject({
      employerId: 'emp-1',
      monthlySalaryCents: 123456,
    })
    expect(dto.monthlySalaryUsd).toBe(1234.56)
    expect(dto.url).toBe(`https://trickle.test/w/invite/${dto.code}`)
  })
})

describe('invite service: read', () => {
  it('reports a pending invite past its expiry as EXPIRED', async () => {
    const s = service({ findByCode: async () => invite({ expiresAt: new Date(Date.now() - 1) }) })
    await expect(s.getByCode('ABCDEF1234')).resolves.toMatchObject({ status: 'EXPIRED' })
  })

  it('returns 404 for an unknown code', async () => {
    const s = service({ findByCode: async () => null })
    await expect(s.getByCode('NOPE000000')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INVITE_NOT_FOUND',
    })
  })
})

describe('invite service: accept', () => {
  const cases: [string, Partial<InviteWithRefs>, number, string][] = [
    ['already accepted', { status: 'ACCEPTED' }, 409, 'INVITE_ALREADY_ACCEPTED'],
    ['revoked', { status: 'REVOKED' }, 409, 'INVITE_REVOKED'],
    ['expired', { expiresAt: new Date(Date.now() - 1) }, 410, 'INVITE_EXPIRED'],
    ['own invite', { createdById: 'me' }, 400, 'CANNOT_ACCEPT_OWN_INVITE'],
  ]

  it.each(cases)('rejects an invite that is %s', async (_name, over, statusCode, code) => {
    const accept = vi.fn()
    const s = service({ findByCode: async () => invite(over), accept })
    await expect(s.accept('ABCDEF1234', 'me')).rejects.toMatchObject({ statusCode, code })
    expect(accept).not.toHaveBeenCalled()
  })

  it('maps a lost race to 409 INVITE_ALREADY_ACCEPTED', async () => {
    const s = service({
      findByCode: async () => invite(),
      accept: async () => ({ status: 'already-accepted' }),
    })
    await expect(s.accept('ABCDEF1234', 'me')).rejects.toMatchObject({
      code: 'INVITE_ALREADY_ACCEPTED',
    })
  })

  it('maps a duplicate link to 409 ALREADY_LINKED', async () => {
    const s = service({
      findByCode: async () => invite({ type: 'FAMILY', employer: null }),
      accept: async () => ({ status: 'already-linked' }),
    })
    await expect(s.accept('ABCDEF1234', 'me')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_LINKED',
      message: 'You are already linked to this worker',
    })
  })

  it('returns the accepted invite', async () => {
    const accepted = invite({ status: 'ACCEPTED', acceptedAt: new Date('2026-10-03T00:00:00Z') })
    const s = service({
      findByCode: async () => invite(),
      accept: async () => ({ status: 'accepted', invite: accepted }),
    })
    await expect(s.accept('ABCDEF1234', 'me')).resolves.toMatchObject({
      status: 'ACCEPTED',
      acceptedAt: '2026-10-03T00:00:00.000Z',
      invitedBy: { name: 'Acme', address: '0xboss' },
    })
  })
})
