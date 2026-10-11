import type { Db } from '../../lib/prisma.js'

const withRoleCounts = {
  companies: { where: { deletedAt: null }, select: { id: true }, take: 1 },
  _count: { select: { employments: true, familyAsRelative: true } },
} as const

export function createUserRepository(db: Db) {
  return {
    async findWithRoleCounts(id: string) {
      return db.user.findUnique({ where: { id }, include: withRoleCounts })
    },

    /** Returns false when the user no longer exists. */
    async update(id: string, data: { displayName: string | null }) {
      const updated = await db.user.updateMany({ where: { id }, data })
      return updated.count === 1
    },
  }
}

export type UserRepository = ReturnType<typeof createUserRepository>
