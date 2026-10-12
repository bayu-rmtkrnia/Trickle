import { describe, expect, it } from 'vitest'
import type { UserRepository } from '../src/modules/users/repository.js'
import { createUserService } from '../src/modules/users/service.js'

function setup(exists = true) {
  const user = {
    id: 'u1',
    address: '0xabc',
    privyId: 'did:privy:u1',
    displayName: null as string | null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    lastLoginAt: null,
    companies: [{ id: 'co-1' }],
    _count: { employments: 1, recipientOf: 0 },
  }
  const repo = {
    async findWithRoleCounts(id) {
      return exists && id === user.id ? user : null
    },
    async update(id, data) {
      if (!exists || id !== user.id) return false
      user.displayName = data.displayName
      return true
    },
  } as UserRepository
  return createUserService(repo)
}

describe('user service', () => {
  it('derives roles and my company from relations', async () => {
    const me = await setup().me('u1')
    expect(me.roles).toEqual({ employer: true, worker: true, recipient: false })
    expect(me.companyId).toBe('co-1')
  })

  it('updates and clears the display name', async () => {
    const service = setup()
    expect((await service.updateMe('u1', { displayName: 'Siti' })).displayName).toBe('Siti')
    expect((await service.updateMe('u1', { displayName: null })).displayName).toBeNull()
  })

  it('maps employments with their employer and pages them', async () => {
    const row = (id: string) => ({
      id,
      companyId: 'co-1',
      userId: 'u1',
      displayName: 'Siti',
      position: null,
      monthlySalaryCents: 120_050,
      createdAt: new Date('2026-10-02T00:00:00Z'),
      updatedAt: new Date('2026-10-02T00:00:00Z'),
      deletedAt: null,
      company: {
        id: 'co-1',
        ownerId: 'boss',
        name: 'PT Maju Jaya',
        country: 'SG',
        createdAt: new Date('2026-10-01T00:00:00Z'),
        updatedAt: new Date('2026-10-01T00:00:00Z'),
        deletedAt: null,
        owner: { address: '0xboss' },
      },
    })
    const repo = {
      listEmployments: async () => [row('w-2'), row('w-1')],
    } as unknown as UserRepository
    const page = await createUserService(repo).listEmployments('u1', { limit: 1 })
    expect(page).toEqual({
      data: [
        {
          id: 'w-2',
          displayName: 'Siti',
          position: null,
          monthlySalaryUsd: 1200.5,
          joinedAt: '2026-10-02T00:00:00.000Z',
          employer: {
            id: 'co-1',
            name: 'PT Maju Jaya',
            country: 'SG',
            ownerAddress: '0xboss',
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        },
      ],
      nextCursor: 'w-2',
    })
  })

  it('returns 401 when the account is gone', async () => {
    const service = setup(false)
    await expect(service.me('u1')).rejects.toMatchObject({ statusCode: 401 })
    await expect(service.updateMe('u1', { displayName: 'x' })).rejects.toMatchObject({
      statusCode: 401,
    })
  })
})
