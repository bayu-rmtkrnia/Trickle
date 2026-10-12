import { describe, expect, it, vi } from 'vitest'
import type { RecipientRepository } from '../src/modules/recipients/repository.js'
import type { RecipientWithUser } from '../src/modules/recipients/schemas.js'
import { createRecipientService } from '../src/modules/recipients/service.js'

const ibu: RecipientWithUser = {
  id: 'r-1',
  ownerId: 'user-siti',
  userId: 'user-ibu',
  displayName: 'Ibu Aminah',
  relation: 'Ibu',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  deletedAt: null,
  user: { address: '0xibu' },
}

const log = { warn: vi.fn() }

/** Only the methods a test touches are filled in; the rest fail loudly. */
function setup(repo: Partial<RecipientRepository>, bps: number | null = null) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  const splitBpsOf = vi.fn(async () => bps)
  const service = createRecipientService({
    streams: { splitBpsOf },
    repo: {
      findAccess: unexpected,
      findActive: unexpected,
      findSplitParties: unexpected,
      findOrCreateUser: unexpected,
      findLink: unexpected,
      upsert: unexpected,
      update: unexpected,
      softDelete: unexpected,
      list: unexpected,
      ...repo,
    } as RecipientRepository,
  })
  return { service, splitBpsOf }
}

const user = (id: string) =>
  ({ id }) as Awaited<ReturnType<RecipientRepository['findOrCreateUser']>>
const parties = { worker: '0xsiti', recipient: '0xibu' } as const
const input = { address: '0xibu', displayName: 'Ibu Aminah' } as const

describe('recipient service', () => {
  it('adds a recipient by address', async () => {
    const upsert = vi.fn(async () => ibu)
    const { service } = setup({
      findOrCreateUser: async () => user('user-ibu'),
      findLink: async () => null,
      upsert,
    })
    const dto = await service.create('user-siti', input)
    expect(upsert).toHaveBeenCalledWith('user-siti', 'user-ibu', {
      displayName: 'Ibu Aminah',
      relation: null,
    })
    expect(dto).toMatchObject({ id: 'r-1', address: '0xibu', relation: 'Ibu' })
  })

  it('refuses to add yourself or an existing recipient, but restores a removed one', async () => {
    const self = setup({ findOrCreateUser: async () => user('user-siti') })
    await expect(self.service.create('user-siti', input)).rejects.toMatchObject({
      statusCode: 400,
      code: 'CANNOT_ADD_SELF',
    })

    const dup = setup({
      findOrCreateUser: async () => user('user-ibu'),
      findLink: async () => ({ id: 'r-1', deletedAt: null }),
    })
    await expect(dup.service.create('user-siti', input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'RECIPIENT_EXISTS',
    })

    const upsert = vi.fn(async () => ibu)
    const removed = setup({
      findOrCreateUser: async () => user('user-ibu'),
      findLink: async () => ({ id: 'r-1', deletedAt: new Date() }),
      upsert,
    })
    await removed.service.create('user-siti', input)
    expect(upsert).toHaveBeenCalled()
  })

  it('refuses to remove the current split recipient', async () => {
    const softDelete = vi.fn()
    const { service, splitBpsOf } = setup(
      { findSplitParties: async () => parties, softDelete },
      3000,
    )
    await expect(service.remove('r-1', log)).rejects.toMatchObject({
      statusCode: 409,
      code: 'SPLIT_ACTIVE',
    })
    expect(splitBpsOf).toHaveBeenCalledWith('0xsiti', '0xibu')
    expect(softDelete).not.toHaveBeenCalled()
  })

  it('removes when the split no longer sends to this recipient', async () => {
    const softDelete = vi.fn(async () => {})
    const { service } = setup({ findSplitParties: async () => parties, softDelete }, 0)
    await service.remove('r-1', log)
    expect(softDelete).toHaveBeenCalledWith('r-1')
  })

  it('removes but logs when the payroll contract is not configured', async () => {
    const softDelete = vi.fn(async () => {})
    const { service } = setup({ findSplitParties: async () => parties, softDelete }, null)
    log.warn.mockClear()
    await service.remove('r-1', log)
    expect(softDelete).toHaveBeenCalledWith('r-1')
    expect(log.warn).toHaveBeenCalledOnce()
  })

  it('answers 404 for a missing recipient', async () => {
    const { service } = setup({ findActive: async () => null, findSplitParties: async () => null })
    await expect(service.get('nope')).rejects.toMatchObject({ code: 'RECIPIENT_NOT_FOUND' })
    await expect(service.remove('nope', log)).rejects.toMatchObject({ statusCode: 404 })
  })
})
