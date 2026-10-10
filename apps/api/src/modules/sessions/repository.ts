import type { Db } from '../../lib/prisma.js'

export function createSessionRepository(db: Db) {
  return {
    async findUserByPrivyId(privyId: string) {
      return db.user.findUnique({ where: { privyId } })
    },

    async recordLogin(userId: string) {
      return db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    },

    /** First Privy sign-in: claims the row for this wallet if it exists, otherwise creates it. */
    async linkPrivyUser(privyId: string, address: `0x${string}`) {
      const now = new Date()
      return db.user.upsert({
        where: { address },
        create: { address, privyId, lastLoginAt: now },
        update: { privyId, lastLoginAt: now },
      })
    },

    async create(data: { userId: string; tokenHash: string; expiresAt: Date }) {
      return db.session.create({ data })
    },

    /** The session behind a bearer token, if it is neither revoked nor expired. */
    async findActive(tokenHash: string) {
      return db.session.findFirst({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, user: { select: { id: true, address: true } } },
      })
    },

    async revoke(id: string) {
      await db.session.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    },
  }
}

export type SessionRepository = ReturnType<typeof createSessionRepository>
