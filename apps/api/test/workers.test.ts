import { describe, expect, it, vi } from 'vitest'
import type { WorkerRepository } from '../src/modules/workers/repository.js'
import type { WorkerWithUser } from '../src/modules/workers/schemas.js'
import { createWorkerService } from '../src/modules/workers/service.js'

const siti: WorkerWithUser = {
  id: 'w-1',
  companyId: 'co-1',
  userId: 'user-siti',
  displayName: 'Siti',
  position: 'Caregiver',
  monthlySalaryCents: 120_000,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  deletedAt: null,
  user: { address: '0xsiti' },
}

const log = { warn: vi.fn() }

/** Only the methods a test touches are filled in; the rest fail loudly. */
function setup(repo: Partial<WorkerRepository>, active = false, verified = true) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  const streams = { verified, hasActiveStream: vi.fn(async () => active) }
  const service = createWorkerService({
    streams,
    repo: {
      findCompanyOwnerId: unexpected,
      findAccess: unexpected,
      findActive: unexpected,
      findStreamParties: unexpected,
      findOrCreateUser: unexpected,
      findMembership: unexpected,
      upsert: unexpected,
      update: unexpected,
      softDelete: unexpected,
      list: unexpected,
      ...repo,
    } as WorkerRepository,
  })
  return { service, streams }
}

const user = (id: string) => ({ id }) as Awaited<ReturnType<WorkerRepository['findOrCreateUser']>>
const parties = { employer: '0xboss', worker: '0xsiti' } as const

describe('worker service', () => {
  it('adds a worker by address and stores the salary in cents', async () => {
    const upsert = vi.fn(async () => siti)
    const { service } = setup({
      findOrCreateUser: async () => user('user-siti'),
      findMembership: async () => null,
      upsert,
    })
    const dto = await service.create('co-1', 'user-boss', {
      address: '0xsiti',
      displayName: 'Siti',
      monthlySalaryUsd: 1200.5,
    })
    expect(upsert).toHaveBeenCalledWith('co-1', 'user-siti', {
      displayName: 'Siti',
      position: null,
      monthlySalaryCents: 120050,
    })
    expect(dto).toMatchObject({ id: 'w-1', address: '0xsiti', monthlySalaryUsd: 1200 })
  })

  it('refuses to add the owner or an existing worker', async () => {
    const self = setup({ findOrCreateUser: async () => user('user-boss') })
    await expect(
      self.service.create('co-1', 'user-boss', {
        address: '0xboss',
        displayName: 'Me',
        monthlySalaryUsd: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'CANNOT_EMPLOY_SELF' })

    const dup = setup({
      findOrCreateUser: async () => user('user-siti'),
      findMembership: async () => ({ id: 'w-1', deletedAt: null }),
    })
    await expect(
      dup.service.create('co-1', 'user-boss', {
        address: '0xsiti',
        displayName: 'Siti',
        monthlySalaryUsd: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'WORKER_EXISTS' })
  })

  it('restores a removed worker instead of refusing', async () => {
    const upsert = vi.fn(async () => siti)
    const { service } = setup({
      findOrCreateUser: async () => user('user-siti'),
      findMembership: async () => ({ id: 'w-1', deletedAt: new Date() }),
      upsert,
    })
    await service.create('co-1', 'user-boss', {
      address: '0xsiti',
      displayName: 'Siti',
      monthlySalaryUsd: 1,
    })
    expect(upsert).toHaveBeenCalled()
  })

  it('refuses to remove a worker with an active stream', async () => {
    const softDelete = vi.fn()
    const { service, streams } = setup({ findStreamParties: async () => parties, softDelete }, true)
    await expect(service.remove('w-1', log)).rejects.toMatchObject({
      statusCode: 409,
      code: 'STREAM_ACTIVE',
    })
    expect(streams.hasActiveStream).toHaveBeenCalledWith('0xboss', '0xsiti')
    expect(softDelete).not.toHaveBeenCalled()
  })

  it('soft-deletes otherwise, and logs when the stream check is a placeholder', async () => {
    const softDelete = vi.fn(async () => {})
    const { service } = setup({ findStreamParties: async () => parties, softDelete }, false, false)
    log.warn.mockClear()
    await service.remove('w-1', log)
    expect(softDelete).toHaveBeenCalledWith('w-1')
    expect(log.warn).toHaveBeenCalledOnce()
  })

  it('answers 404 for a missing worker', async () => {
    const { service } = setup({ findActive: async () => null, findStreamParties: async () => null })
    await expect(service.get('nope')).rejects.toMatchObject({ code: 'WORKER_NOT_FOUND' })
    await expect(service.remove('nope', log)).rejects.toMatchObject({ statusCode: 404 })
  })
})
