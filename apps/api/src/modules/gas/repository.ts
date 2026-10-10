import { Prisma, type GasDrip } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/prisma.js'

/** `taken`: another request claimed this address first; `drip` is its row. */
export type ClaimResult = { status: 'claimed'; drip: GasDrip } | { status: 'taken'; drip: GasDrip }

export function createGasRepository(db: Db) {
  return {
    async findByAddress(address: string) {
      return db.gasDrip.findUnique({ where: { address } })
    },

    /** Drips that were sent or are still in flight since `since`. */
    async countActiveSince(since: Date) {
      return db.gasDrip.count({
        where: { createdAt: { gte: since }, status: { not: 'FAILED' } },
      })
    },

    /**
     * Claims the address before sending anything: retries a FAILED row, or
     * inserts a new one. The unique constraint makes concurrent calls safe.
     */
    async claim(
      previous: GasDrip | null,
      data: { address: string; amountWei: string; ip: string },
    ): Promise<ClaimResult> {
      try {
        const drip = previous
          ? await db.gasDrip.update({
              where: { id: previous.id },
              data: { status: 'PENDING', error: null, amountWei: data.amountWei, ip: data.ip },
            })
          : await db.gasDrip.create({ data })
        return { status: 'claimed', drip }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const drip = await db.gasDrip.findUniqueOrThrow({ where: { address: data.address } })
          return { status: 'taken', drip }
        }
        throw err
      }
    },

    async markSent(id: string, txHash: string) {
      return db.gasDrip.update({ where: { id }, data: { status: 'SENT', txHash } })
    },

    async markFailed(id: string, error: string) {
      await db.gasDrip.update({ where: { id }, data: { status: 'FAILED', error } })
    },
  }
}

export type GasRepository = ReturnType<typeof createGasRepository>
