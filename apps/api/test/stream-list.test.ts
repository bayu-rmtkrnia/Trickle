import { describe, expect, it, vi } from 'vitest'
import type { Stream } from '../src/generated/prisma/client.js'
import type { StreamRepository } from '../src/modules/streams/repository.js'
import { statusOf } from '../src/modules/streams/schemas.js'
import { createStreamService } from '../src/modules/streams/service.js'

const NOW = new Date('2026-10-13T00:00:00Z')
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

const stream = (id: bigint, over: Partial<Stream> = {}): Stream => ({
  id,
  employer: '0xboss',
  worker: '0xsiti',
  amountUnits: '1000',
  withdrawnUnits: '0',
  refundedUnits: '0',
  startsAt: at(-60),
  endsAt: at(60),
  canceled: false,
  settled: false,
  syncedAt: NOW,
  ...over,
})

function setup(rows: Stream[], syncNew = vi.fn(async () => {})) {
  const repo = {
    findCompanyOwner: async () => ({ ownerId: 'u-boss', address: '0xboss' }),
    findAddress: async () => '0xsiti',
    listByEmployer: async () => rows,
    listByWorker: async () => rows,
    findWorkers: async () => new Map([['0xsiti', { id: 'w-1', displayName: 'Siti' }]]),
    findCompanies: async () => new Map([['0xboss', { id: 'co-1', name: 'PT Maju Jaya' }]]),
  } as unknown as StreamRepository
  const log = { warn: vi.fn() }
  const service = createStreamService({ repo, streams: { syncNew }, now: () => NOW })
  return { service, log, syncNew }
}

describe('stream status', () => {
  it('is derived from cancel flag and the time window', () => {
    expect(statusOf(stream(1n, { canceled: true }), NOW)).toBe('CANCELED')
    expect(statusOf(stream(1n, { startsAt: at(1) }), NOW)).toBe('SCHEDULED')
    expect(statusOf(stream(1n), NOW)).toBe('ACTIVE')
    expect(statusOf(stream(1n, { endsAt: NOW }), NOW)).toBe('ENDED')
  })
})

describe('stream lists', () => {
  it('links company streams to the worker row and pages by stream id', async () => {
    const { service, log, syncNew } = setup([
      stream(12n),
      stream(9n, { worker: '0xother', canceled: true }),
    ])
    const page = await service.listForCompany('co-1', { limit: 1 }, log)
    expect(syncNew).toHaveBeenCalledOnce()
    expect(page).toEqual({
      data: [
        expect.objectContaining({
          id: '12',
          employerAddress: '0xboss',
          workerAddress: '0xsiti',
          status: 'ACTIVE',
          worker: { id: 'w-1', displayName: 'Siti' },
        }),
      ],
      nextCursor: '12',
    })
  })

  it('links my streams to the paying company, or null for an unknown employer', async () => {
    const { service, log } = setup([stream(3n), stream(2n, { employer: '0xdemo' })])
    const page = await service.listMine('u-siti', { limit: 20 }, log)
    expect(page.nextCursor).toBeNull()
    expect(page.data.map((s) => s.company)).toEqual([{ id: 'co-1', name: 'PT Maju Jaya' }, null])
  })

  it('serves the cache when the indexer catch-up fails', async () => {
    const { service, log } = setup(
      [stream(1n)],
      vi.fn(async () => {
        throw new Error('rpc down')
      }),
    )
    const page = await service.listMine('u-siti', { limit: 20 }, log)
    expect(page.data).toHaveLength(1)
    expect(log.warn).toHaveBeenCalledOnce()
  })
})
