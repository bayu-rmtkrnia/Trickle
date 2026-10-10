import { conflict, notFound } from '../../lib/errors.js'
import { centsToUsd } from '../../lib/money.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { CompanyRepository } from './repository.js'
import { toCompanyDto, type CompanyInput } from './schemas.js'

export const companyNotFound = () => notFound('COMPANY_NOT_FOUND', 'Company not found')

/**
 * Methods taking a company id assume the route already checked ownership
 * (`app.requireOwnership`). They still answer 404 if the company vanished
 * in between.
 */
export function createCompanyService(repo: CompanyRepository) {
  async function find(id: string) {
    const company = await repo.findActive(id)
    if (!company) throw companyNotFound()
    return company
  }

  return {
    async create(userId: string, input: CompanyInput) {
      if (await repo.findActiveByOwner(userId)) {
        throw conflict('COMPANY_EXISTS', 'You already have a company')
      }
      return toCompanyDto(await repo.create(userId, input))
    },

    async get(id: string) {
      return toCompanyDto(await find(id))
    },

    async update(id: string, input: Partial<CompanyInput>) {
      await find(id)
      return toCompanyDto(await repo.update(id, input))
    },

    async remove(id: string) {
      await find(id)
      // Streams live on-chain; removing workers first keeps the employer from
      // orphaning anyone who is still being paid.
      if ((await repo.countWorkers(id)) > 0) {
        throw conflict(
          'COMPANY_HAS_WORKERS',
          'Remove all workers from this company before deleting it',
        )
      }
      await repo.softDelete(id)
    },

    async listWorkers(id: string, page: PageQuery) {
      await find(id)
      const rows = await repo.listWorkers(id, page)
      return toPage(rows, page.limit, (w) => ({
        id: w.id,
        displayName: w.displayName,
        address: w.worker.address,
        monthlySalaryUsd: centsToUsd(w.monthlySalaryCents),
        joinedAt: w.createdAt.toISOString(),
      }))
    },
  }
}

export type CompanyService = ReturnType<typeof createCompanyService>
