import type { FieldCipher } from '../../lib/crypto.js'
import { AppError, conflict, notFound } from '../../lib/errors.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { BankAccountRepository } from './repository.js'
import {
  toBankAccountDto,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from './schemas.js'

export const bankAccountNotFound = () =>
  notFound('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found')

/** Enough for a family; stops one account from filling the table. */
export const MAX_BANK_ACCOUNTS = 5

interface Deps {
  repo: BankAccountRepository
  /** `undefined` when `BANK_ENCRYPTION_KEY` is not set: adding accounts answers 503. */
  cipher: FieldCipher | undefined
}

/**
 * Methods taking an account id assume the route already checked ownership.
 * They still answer 404 if the row vanished in between.
 */
export function createBankAccountService({ repo, cipher }: Deps) {
  async function find(id: string) {
    const account = await repo.findActive(id)
    if (!account) throw bankAccountNotFound()
    return account
  }

  return {
    async create(userId: string, input: CreateBankAccountInput) {
      if (!cipher) {
        throw new AppError(503, 'BANK_ACCOUNTS_UNAVAILABLE', 'Bank accounts are not configured')
      }
      const number = input.accountNumber
      const fingerprint = cipher.fingerprint(`${input.bankCode}:${number}`)
      const existing = await repo.findByFingerprint(userId, fingerprint)
      if (existing && !existing.deletedAt) {
        throw conflict('BANK_ACCOUNT_EXISTS', 'You already added this bank account')
      }
      if ((await repo.countActive(userId)) >= MAX_BANK_ACCOUNTS) {
        throw conflict(
          'BANK_ACCOUNT_LIMIT',
          `You can keep up to ${MAX_BANK_ACCOUNTS} bank accounts. Remove one first.`,
        )
      }
      const account = await repo.upsert(userId, fingerprint, {
        bankCode: input.bankCode,
        accountName: input.accountName,
        label: input.label ?? null,
        // The owner's id is bound to the ciphertext, so it cannot be moved to another user's row.
        numberEncrypted: cipher.encrypt(number, userId),
        numberLast4: number.slice(-4),
      })
      return toBankAccountDto(account)
    },

    async list(userId: string, page: PageQuery) {
      return toPage(await repo.list(userId, page), page.limit, toBankAccountDto)
    },

    async get(id: string) {
      return toBankAccountDto(await find(id))
    },

    async update(id: string, input: UpdateBankAccountInput) {
      await find(id)
      return toBankAccountDto(await repo.update(id, input))
    },

    async remove(id: string) {
      await find(id)
      await repo.softDelete(id)
    },
  }
}

export type BankAccountService = ReturnType<typeof createBankAccountService>
