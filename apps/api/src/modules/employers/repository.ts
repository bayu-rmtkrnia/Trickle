import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { EmployerInput } from './schemas.js'

const withOwner = { owner: { select: { address: true } } } as const

export function createEmployerRepository(db: Db) {
  return {
    async findByOwner(ownerId: string) {
      return db.employer.findUnique({ where: { ownerId }, include: withOwner })
    },

    async create(ownerId: string, data: EmployerInput) {
      return db.employer.create({ data: { ...data, ownerId }, include: withOwner })
    },

    async update(id: string, data: Partial<EmployerInput>) {
      return db.employer.update({ where: { id }, data, include: withOwner })
    },

    /** One page of workers, plus one extra row for `toPage` to detect the next page. */
    async listWorkers(employerId: string, page: PageQuery) {
      return db.employerWorker.findMany({
        where: { employerId },
        include: { worker: { select: { address: true } } },
        ...pageArgs(page),
      })
    },
  }
}

export type EmployerRepository = ReturnType<typeof createEmployerRepository>
