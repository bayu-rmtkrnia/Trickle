import type { SplitPayment } from '../../generated/prisma/client.js'
import type { PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'

export function createIncomingTransferRepository(db: Db) {
  return {
    async findAddress(userId: string) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { address: true } })
      return user?.address ?? null
    },

    /** Newest first. Block and log index order transfers exactly, even within one second. */
    async listByRecipient(
      recipient: string,
      { limit, cursor }: PageQuery,
    ): Promise<SplitPayment[]> {
      return db.splitPayment.findMany({
        where: { recipient },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
      })
    },

    /** Trickle accounts behind worker `addresses`, keyed by lowercased address. */
    async findSenders(addresses: string[]) {
      const users = await db.user.findMany({
        where: { address: { in: addresses, mode: 'insensitive' } },
        select: {
          id: true,
          address: true,
          displayName: true,
          employments: {
            where: { deletedAt: null },
            select: { displayName: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
      return new Map(
        users.map((u) => [
          u.address.toLowerCase(),
          { id: u.id, displayName: u.displayName ?? u.employments[0]?.displayName ?? null },
        ]),
      )
    },
  }
}

export type IncomingTransferRepository = ReturnType<typeof createIncomingTransferRepository>
