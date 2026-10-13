import { Prisma, type GasDrip } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/prisma.js'

/** `taken`: another request claimed this drip first; `drip` is its row. */
export type ClaimResult = { status: 'claimed'; drip: GasDrip } | { status: 'taken'; drip: GasDrip }

/** Failed drips do not count towards any limit. */
const active = (since: Date) => ({
  createdAt: { gte: since },
  status: { not: 'FAILED' as const },
})

export function createGasRepository(db: Db) {
  return {
    /** The address's most recent drip (highest `seq`), or null if it never had one. */
    async findLatest(address: string) {
      return db.gasDrip.findFirst({ where: { address }, orderBy: { seq: 'desc' } })
    },

    /** Drips that were sent or are still in flight since `since`. */
    async countActiveSince(since: Date) {
      return db.gasDrip.count({ where: active(since) })
    },

    /** First drips only: the per-IP cap is about new accounts, not refills. */
    async countFirstFromIpSince(ip: string, since: Date) {
      return db.gasDrip.count({ where: { ip, seq: 0, ...active(since) } })
    },

    async countActiveForAddressSince(address: string, since: Date) {
      return db.gasDrip.count({ where: { address, ...active(since) } })
    },

    /**
     * Claims the next drip before sending anything: retries `latest` when it
     * FAILED, otherwise inserts the next `seq`. The (address, seq) unique
     * constraint and the conditional retry make concurrent calls safe.
     */
    async claim(
      latest: GasDrip | null,
      data: { address: string; amountWei: string; ip: string },
    ): Promise<ClaimResult> {
      if (latest?.status === 'FAILED') {
        const { count } = await db.gasDrip.updateMany({
          where: { id: latest.id, status: 'FAILED' },
          data: { status: 'PENDING', error: null, amountWei: data.amountWei, ip: data.ip },
        })
        const drip = await db.gasDrip.findUniqueOrThrow({ where: { id: latest.id } })
        return { status: count === 1 ? 'claimed' : 'taken', drip }
      }

      const seq = latest ? latest.seq + 1 : 0
      try {
        return { status: 'claimed', drip: await db.gasDrip.create({ data: { ...data, seq } }) }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const drip = await db.gasDrip.findUniqueOrThrow({
            where: { address_seq: { address: data.address, seq } },
          })
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
