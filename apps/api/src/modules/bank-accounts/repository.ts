import type { BankAccount } from '../../generated/prisma/client.js'
import { pageArgs, type PageQuery } from '../../lib/pagination.js'
import type { Db } from '../../lib/prisma.js'

const active = { deletedAt: null }

export interface BankAccountData {
  bankCode: string
  accountName: string
  label: string | null
  numberEncrypted: string
  numberLast4: string
}

export function createBankAccountRepository(db: Db) {
  return {
    /** Owner of an active account, or null. Guards `/bank-accounts/:id`. */
    async findOwnerId(id: string) {
      const account = await db.bankAccount.findFirst({
        where: { id, ...active },
        select: { userId: true },
      })
      return account?.userId ?? null
    },

    async findActive(id: string): Promise<BankAccount | null> {
      return db.bankAccount.findFirst({ where: { id, ...active } })
    },

    async findByFingerprint(userId: string, numberFingerprint: string) {
      return db.bankAccount.findUnique({
        where: { userId_numberFingerprint: { userId, numberFingerprint } },
        select: { id: true, deletedAt: true },
      })
    },

    async countActive(userId: string) {
      return db.bankAccount.count({ where: { userId, ...active } })
    },

    /** Creates the account, or restores a removed one with fresh data. */
    async upsert(
      userId: string,
      numberFingerprint: string,
      data: BankAccountData,
    ): Promise<BankAccount> {
      return db.bankAccount.upsert({
        where: { userId_numberFingerprint: { userId, numberFingerprint } },
        create: { userId, numberFingerprint, ...data },
        update: { ...data, deletedAt: null, createdAt: new Date() },
      })
    },

    async update(
      id: string,
      data: { accountName?: string; label?: string | null },
    ): Promise<BankAccount> {
      return db.bankAccount.update({ where: { id }, data })
    },

    async softDelete(id: string) {
      await db.bankAccount.update({ where: { id }, data: { deletedAt: new Date() } })
    },

    async list(userId: string, page: PageQuery): Promise<BankAccount[]> {
      return db.bankAccount.findMany({ where: { userId, ...active }, ...pageArgs(page) })
    },
  }
}

export type BankAccountRepository = ReturnType<typeof createBankAccountRepository>
