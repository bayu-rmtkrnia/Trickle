import { describe, expect, it, vi } from 'vitest'
import type { SplitPayment } from '../src/generated/prisma/client.js'
import type { IncomingTransferRepository } from '../src/modules/incoming-transfers/repository.js'
import { createIncomingTransferService } from '../src/modules/incoming-transfers/service.js'

const row: SplitPayment = {
  id: 'sp-1',
  txHash: '0xabc',
  logIndex: 0,
  blockNumber: 10n,
  paidAt: new Date('2026-11-15T07:00:00Z'),
  streamId: 7n,
  worker: '0xsiti',
  recipient: '0xibu',
  amountUnits: '1500000',
  createdAt: new Date('2026-11-15T07:00:05Z'),
}

function setup(catchUp = vi.fn(async () => ({}))) {
  const listByRecipient = vi.fn(async () => [row])
  const repo = {
    findAddress: async () => '0xIBU',
    listByRecipient,
    findSenders: async () => new Map([['0xsiti', { id: 'u-siti', displayName: 'Siti' }]]),
  } as unknown as IncomingTransferRepository
  const service = createIncomingTransferService({ repo, splits: { catchUp } as never })
  return { service, catchUp, listByRecipient, log: { warn: vi.fn() } }
}

describe('incoming transfers', () => {
  it('reads the newest blocks first, then lists by the lowercased wallet', async () => {
    const { service, catchUp, listByRecipient, log } = setup()
    const page = await service.listMine('u-ibu', { limit: 20 }, log)
    expect(catchUp).toHaveBeenCalledOnce()
    expect(listByRecipient).toHaveBeenCalledWith('0xibu', { limit: 20 })
    expect(page).toEqual({
      data: [
        {
          id: 'sp-1',
          txHash: '0xabc',
          streamId: '7',
          workerAddress: '0xsiti',
          amountUnits: '1500000',
          paidAt: '2026-11-15T07:00:00.000Z',
          sender: { id: 'u-siti', displayName: 'Siti' },
        },
      ],
      nextCursor: null,
    })
  })

  it('serves what is stored when the catch-up fails', async () => {
    const { service, log } = setup(
      vi.fn(async () => {
        throw new Error('rpc down')
      }),
    )
    const page = await service.listMine('u-ibu', { limit: 20 }, log)
    expect(page.data).toHaveLength(1)
    expect(log.warn).toHaveBeenCalledOnce()
  })

  it('works without an indexer (PAYROLL_ADDRESS unset)', async () => {
    const repo = {
      findAddress: async () => '0xibu',
      listByRecipient: async () => [],
      findSenders: async () => new Map(),
    } as unknown as IncomingTransferRepository
    const service = createIncomingTransferService({ repo, splits: null })
    await expect(service.listMine('u-ibu', { limit: 20 }, { warn: vi.fn() })).resolves.toEqual({
      data: [],
      nextCursor: null,
    })
  })
})
