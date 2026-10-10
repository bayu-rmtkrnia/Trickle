import type { Db } from '../../lib/prisma.js'

export function createHealthRepository(db: Db) {
  return {
    /** Resolves when the database answers, rejects otherwise. */
    async ping() {
      await db.$queryRaw`SELECT 1`
    },
  }
}

export type HealthRepository = ReturnType<typeof createHealthRepository>
