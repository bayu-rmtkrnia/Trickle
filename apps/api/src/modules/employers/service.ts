import { conflict, notFound } from '../../lib/errors.js'
import { centsToUsd } from '../../lib/money.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { EmployerRepository } from './repository.js'
import { toEmployerDto, type EmployerInput } from './schemas.js'

const noProfile = () => notFound('EMPLOYER_NOT_FOUND', 'You have no company profile yet')

export function createEmployerService(repo: EmployerRepository) {
  async function requireOwn(userId: string) {
    const employer = await repo.findByOwner(userId)
    if (!employer) throw noProfile()
    return employer
  }

  return {
    async create(userId: string, input: EmployerInput) {
      if (await repo.findByOwner(userId)) {
        throw conflict('EMPLOYER_EXISTS', 'You already have a company profile')
      }
      return toEmployerDto(await repo.create(userId, input))
    },

    async getMine(userId: string) {
      return toEmployerDto(await requireOwn(userId))
    },

    async updateMine(userId: string, input: Partial<EmployerInput>) {
      const employer = await requireOwn(userId)
      return toEmployerDto(await repo.update(employer.id, input))
    },

    async listMyWorkers(userId: string, page: PageQuery) {
      const employer = await requireOwn(userId)
      const rows = await repo.listWorkers(employer.id, page)
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

export type EmployerService = ReturnType<typeof createEmployerService>
