import type { Db } from '../../lib/prisma.js'

export function createAuthRepository(db: Db) {
  return {
    async createChallenge(data: { nonce: string; address: `0x${string}`; expiresAt: Date }) {
      return db.authChallenge.create({ data })
    },

    async findChallenge(nonce: string) {
      return db.authChallenge.findUnique({ where: { nonce } })
    },

    /** Burns the nonce atomically. Returns false when another request burned it first. */
    async burnChallenge(nonce: string) {
      const burned = await db.authChallenge.updateMany({
        where: { nonce, usedAt: null },
        data: { usedAt: new Date() },
      })
      return burned.count === 1
    },

    async upsertUserOnLogin(address: `0x${string}`) {
      return db.user.upsert({
        where: { address },
        create: { address, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date() },
      })
    },

    async findUserWithRoleCounts(id: string) {
      return db.user.findUnique({
        where: { id },
        include: {
          employer: { select: { id: true } },
          _count: { select: { employments: true, familyAsRelative: true } },
        },
      })
    },
  }
}

export type AuthRepository = ReturnType<typeof createAuthRepository>
