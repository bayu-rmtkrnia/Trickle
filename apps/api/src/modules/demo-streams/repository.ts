import { Prisma, type DemoStream } from '../../generated/prisma/client.js'
import type { Db } from '../../lib/prisma.js'

/** `taken`: a concurrent request claimed this account first; `stream` is its row. */
export type ClaimResult =
  { status: 'claimed'; stream: DemoStream } | { status: 'taken'; stream: DemoStream }

interface ClaimData {
  userId: string
  address: string
  amountUnits: string
  durationSeconds: number
  ip: string
}

export function createDemoStreamRepository(db: Db) {
  /** Rows that were sent or are still in flight; failed attempts do not count. */
  const active = (since: Date) => ({
    createdAt: { gte: since },
    status: { not: 'FAILED' as const },
  })

  return {
    async findByUser(userId: string) {
      return db.demoStream.findUnique({ where: { userId } })
    },

    async countActiveSince(since: Date) {
      return db.demoStream.count({ where: active(since) })
    },

    async countActiveFromIpSince(ip: string, since: Date) {
      return db.demoStream.count({ where: { ip, ...active(since) } })
    },

    /**
     * Claims the account before anything goes on-chain: retries a FAILED row,
     * or inserts a new one. The unique `userId` makes concurrent calls safe.
     */
    async claim(previous: DemoStream | null, data: ClaimData): Promise<ClaimResult> {
      try {
        const stream = previous
          ? await db.demoStream.update({
              where: { id: previous.id },
              data: { ...data, status: 'PENDING', error: null },
            })
          : await db.demoStream.create({ data })
        return { status: 'claimed', stream }
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const stream = await db.demoStream.findUniqueOrThrow({ where: { userId: data.userId } })
          return { status: 'taken', stream }
        }
        throw err
      }
    },

    async markSent(
      id: string,
      tx: { streamId: string; txHash: string; startsAt: Date; endsAt: Date },
    ) {
      return db.demoStream.update({ where: { id }, data: { status: 'SENT', ...tx } })
    },

    async markFailed(id: string, error: string) {
      await db.demoStream.update({ where: { id }, data: { status: 'FAILED', error } })
    },
  }
}

export type DemoStreamRepository = ReturnType<typeof createDemoStreamRepository>
