import { describe, expect, it, vi } from 'vitest'
import type { CompanyRepository } from '../src/modules/companies/repository.js'
import { createCompanyService } from '../src/modules/companies/service.js'

const acme = {
  id: 'co-1',
  ownerId: 'user-1',
  name: 'Acme',
  country: 'MY',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  deletedAt: null,
  owner: { address: '0xowner' },
}

/** Only the methods a test touches are filled in; the rest fail loudly. */
function service(repo: Partial<CompanyRepository>) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createCompanyService({
    findActiveByOwner: unexpected,
    findOwnerId: unexpected,
    findActive: unexpected,
    create: unexpected,
    update: unexpected,
    countWorkers: unexpected,
    softDelete: unexpected,
    listWorkers: unexpected,
    ...repo,
  } as CompanyRepository)
}

describe('company service', () => {
  it('refuses a second active company with 409', async () => {
    const s = service({ findActiveByOwner: async () => ({ id: 'co-1' }) })
    await expect(s.create('user-1', { name: 'Acme 2' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'COMPANY_EXISTS',
    })
  })

  it('creates a company when the old one was deleted', async () => {
    const create = vi.fn(async () => acme)
    const s = service({ findActiveByOwner: async () => null, create })
    expect(await s.create('user-1', { name: 'Acme' })).toMatchObject({ id: 'co-1' })
    expect(create).toHaveBeenCalledWith('user-1', { name: 'Acme' })
  })

  it('answers 404 for a missing or deleted company', async () => {
    const s = service({ findActive: async () => null })
    await expect(s.get('co-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'COMPANY_NOT_FOUND',
    })
  })

  it('refuses to delete a company that still has workers', async () => {
    const softDelete = vi.fn()
    const s = service({ findActive: async () => acme, countWorkers: async () => 2, softDelete })
    await expect(s.remove('co-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'COMPANY_HAS_WORKERS',
    })
    expect(softDelete).not.toHaveBeenCalled()
  })

  it('soft-deletes an empty company', async () => {
    const softDelete = vi.fn(async () => {})
    const s = service({ findActive: async () => acme, countWorkers: async () => 0, softDelete })
    await s.remove('co-1')
    expect(softDelete).toHaveBeenCalledWith('co-1')
  })
})
