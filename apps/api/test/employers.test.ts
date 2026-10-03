import { describe, expect, it } from 'vitest'
import type { EmployerRepository } from '../src/modules/employers/repository.js'
import { createEmployerService } from '../src/modules/employers/service.js'

const owner = { address: '0xowner' }
const acme = {
  id: 'emp-1',
  ownerId: 'user-1',
  name: 'Acme',
  country: 'MY',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  owner,
}

/** Only the methods a test touches are filled in; the rest fail loudly. */
function service(repo: Partial<EmployerRepository>) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createEmployerService({
    findByOwner: unexpected,
    create: unexpected,
    update: unexpected,
    listWorkers: unexpected,
    ...repo,
  } as EmployerRepository)
}

describe('employer service', () => {
  it('refuses a second company profile with 409', async () => {
    const s = service({ findByOwner: async () => acme as never })
    await expect(s.create('user-1', { name: 'Acme 2' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMPLOYER_EXISTS',
    })
  })

  it('returns 404 when the user has no company yet', async () => {
    const s = service({ findByOwner: async () => null })
    await expect(s.getMine('user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'EMPLOYER_NOT_FOUND',
    })
    await expect(s.updateMine('user-1', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('maps the profile to its DTO', async () => {
    const s = service({ findByOwner: async () => acme as never })
    await expect(s.getMine('user-1')).resolves.toEqual({
      id: 'emp-1',
      name: 'Acme',
      country: 'MY',
      ownerAddress: '0xowner',
      createdAt: '2026-10-01T00:00:00.000Z',
    })
  })

  it('lists workers with salaries in USD and a next cursor', async () => {
    const row = (id: string) => ({
      id,
      displayName: `Worker ${id}`,
      monthlySalaryCents: 123_45,
      createdAt: new Date('2026-10-02T00:00:00Z'),
      worker: { address: `0x${id}` },
    })
    const s = service({
      findByOwner: async () => acme as never,
      listWorkers: async () => [row('w2'), row('w1')] as never,
    })

    const page = await s.listMyWorkers('user-1', { limit: 1 })
    expect(page.data).toEqual([
      {
        id: 'w2',
        displayName: 'Worker w2',
        address: '0xw2',
        monthlySalaryUsd: 123.45,
        joinedAt: '2026-10-02T00:00:00.000Z',
      },
    ])
    expect(page.nextCursor).toBe('w2')
  })
})
