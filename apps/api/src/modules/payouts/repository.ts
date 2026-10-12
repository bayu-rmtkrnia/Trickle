import { Prisma } from '../../generated/prisma/client.js'
import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'
import type { PayoutWithAccount } from './schemas.js'

const withAccount = {
  bankAccount: { select: { id: true, bankCode: true, numberLast4: true } },
} as const

/** Only these can still change; COMPLETED and FAILED are final. */
const OPEN = ['PENDING', 'PROCESSING'] as const

export type FinalStatus = 'COMPLETED' | 'FAILED'

interface NewPayout {
  userId: string
  bankAccountId: string
  sourceTxHash: string
  amountUnits: string
  amountIdr: number
  fxRate: number
  fxSource: string
  provider: string
}

export function createPayoutRepository(db: Db) {
  return {
    /** Owner of a payout, or null. Guards `GET /payouts/:id`. */
    async findOwnerId(id: string) {
      const payout = await db.payout.findUnique({ where: { id }, select: { userId: true } })
      return payout?.userId ?? null
    },

    async findById(id: string): Promise<PayoutWithAccount | null> {
      return db.payout.findUnique({ where: { id }, include: withAccount })
    },

    async findByTxHash(sourceTxHash: string): Promise<PayoutWithAccount | null> {
      return db.payout.findUnique({ where: { sourceTxHash }, include: withAccount })
    },

    /** An active account of this user, with what the provider needs. */
    async findBankAccount(id: string, userId: string) {
      return db.bankAccount.findFirst({
        where: { id, userId, deletedAt: null },
        select: { id: true, bankCode: true, accountName: true, numberEncrypted: true },
      })
    },

    /** `null` when a concurrent request already created the payout for this transfer. */
    async create(data: NewPayout): Promise<PayoutWithAccount | null> {
      try {
        return await db.payout.create({ data, include: withAccount })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null
        throw err
      }
    },

    async markStarted(id: string, providerRef: string, status: 'PROCESSING' | FinalStatus) {
      return db.payout.update({
        where: { id },
        data: { providerRef, status },
        include: withAccount,
      })
    },

    async markFailed(id: string, failureReason: string) {
      return db.payout.update({
        where: { id },
        data: { status: 'FAILED', failureReason },
        include: withAccount,
      })
    },

    /**
     * Applies a final status from the provider. Guarded on the open statuses,
     * so a late or repeated webhook cannot overwrite a finished payout.
     * Returns false when no payout has this reference.
     */
    async finish(providerRef: string, status: FinalStatus, failureReason?: string) {
      await db.payout.updateMany({
        where: { providerRef, status: { in: [...OPEN] } },
        data: { status, failureReason: status === 'FAILED' ? (failureReason ?? null) : null },
      })
      return (await db.payout.count({ where: { providerRef } })) > 0
    },

    async list(userId: string, page: PageQuery): Promise<PayoutWithAccount[]> {
      return db.payout.findMany({ where: { userId }, include: withAccount, ...pageArgs(page) })
    },
  }
}

export type PayoutRepository = ReturnType<typeof createPayoutRepository>
