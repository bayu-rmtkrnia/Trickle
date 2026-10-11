import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { RecipientWithUser } from './schemas.js'

const withUser = { user: { select: { address: true } } } as const
const active = { deletedAt: null }

type RecipientData = { displayName: string; relation?: string | null }

export function createRecipientRepository(db: Db) {
  return {
    /** Who may read an active recipient: the owning worker and the recipient themself. */
    async findAccess(id: string) {
      return db.recipient.findFirst({
        where: { id, ...active },
        select: { ownerId: true, userId: true },
      })
    },

    async findActive(id: string): Promise<RecipientWithUser | null> {
      return db.recipient.findFirst({ where: { id, ...active }, include: withUser })
    },

    /** Addresses of the worker and the recipient, to compare with the on-chain split. */
    async findSplitParties(id: string) {
      const recipient = await db.recipient.findFirst({
        where: { id, ...active },
        select: { owner: { select: { address: true } }, user: { select: { address: true } } },
      })
      return (
        recipient && {
          worker: recipient.owner.address as `0x${string}`,
          recipient: recipient.user.address as `0x${string}`,
        }
      )
    },

    /** The user behind an address, created if they never signed in (linked on first Privy login). */
    async findOrCreateUser(address: `0x${string}`) {
      return db.user.upsert({ where: { address }, create: { address }, update: {} })
    },

    async findLink(ownerId: string, userId: string) {
      return db.recipient.findUnique({
        where: { ownerId_userId: { ownerId, userId } },
        select: { id: true, deletedAt: true },
      })
    },

    /** Creates the recipient, or restores a removed one with fresh data. */
    async upsert(ownerId: string, userId: string, data: RecipientData): Promise<RecipientWithUser> {
      return db.recipient.upsert({
        where: { ownerId_userId: { ownerId, userId } },
        create: { ownerId, userId, ...data },
        update: { ...data, deletedAt: null, createdAt: new Date() },
        include: withUser,
      })
    },

    async update(id: string, data: Partial<RecipientData>): Promise<RecipientWithUser> {
      return db.recipient.update({ where: { id }, data, include: withUser })
    },

    async softDelete(id: string) {
      await db.recipient.update({ where: { id }, data: { deletedAt: new Date() } })
    },

    async list(ownerId: string, page: PageQuery): Promise<RecipientWithUser[]> {
      return db.recipient.findMany({
        where: { ownerId, ...active },
        include: withUser,
        ...pageArgs(page),
      })
    },
  }
}

export type RecipientRepository = ReturnType<typeof createRecipientRepository>
