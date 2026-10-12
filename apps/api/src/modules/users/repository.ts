import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { EmploymentRow } from './schemas.js'

const withRoleCounts = {
  companies: { where: { deletedAt: null }, select: { id: true }, take: 1 },
  _count: {
    select: {
      employments: { where: { deletedAt: null, company: { deletedAt: null } } },
      recipientOf: { where: { deletedAt: null } },
    },
  },
} as const

export function createUserRepository(db: Db) {
  return {
    async findWithRoleCounts(id: string) {
      return db.user.findUnique({ where: { id }, include: withRoleCounts })
    },

    /** My employments while neither the worker row nor the company is soft-deleted. */
    async listEmployments(userId: string, page: PageQuery): Promise<EmploymentRow[]> {
      return db.worker.findMany({
        where: { userId, deletedAt: null, company: { deletedAt: null } },
        include: { company: { include: { owner: { select: { address: true } } } } },
        ...pageArgs(page),
      })
    },

    /** Returns false when the user no longer exists. */
    async update(id: string, data: { displayName: string | null }) {
      const updated = await db.user.updateMany({ where: { id }, data })
      return updated.count === 1
    },
  }
}

export type UserRepository = ReturnType<typeof createUserRepository>
