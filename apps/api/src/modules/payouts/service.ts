import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyBaseLogger } from 'fastify'
import type { Address } from 'viem'
import type { FieldCipher } from '../../lib/crypto.js'
import { AppError, badRequest, conflict, notFound, unauthorized } from '../../lib/errors.js'
import type { FxService } from '../../lib/fx.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import type { PayoutProvider } from '../../lib/payout-provider.js'
import type { TransferVerifier } from '../../lib/transfers.js'
import type { PayoutRepository } from './repository.js'
import { toPayoutDto, type CreatePayoutInput, type PayoutWithAccount } from './schemas.js'

export const payoutNotFound = () => notFound('PAYOUT_NOT_FOUND', 'Payout not found')

/** Token units per USD (mock AUSD, like AUSD, has 6 decimals). */
const UNITS_PER_USD = 1_000_000
/** Webhooks older than this are refused, so a captured request cannot be replayed later. */
const WEBHOOK_MAX_AGE_SECONDS = 5 * 60

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'error' | 'warn'>

interface Deps {
  repo: PayoutRepository
  transfers: TransferVerifier
  provider: PayoutProvider
  fx: FxService
  /** `undefined` without `BANK_ENCRYPTION_KEY`: payouts cannot read account numbers. */
  cipher: FieldCipher | undefined
  webhookSecret: string | undefined
  now?: () => number
}

/** `sha256=` + hex HMAC of `<timestamp>.<body>`, as the provider signs it. */
export const signWebhook = (secret: string, timestamp: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

export function createPayoutService(deps: Deps) {
  const { repo, transfers, provider, fx, cipher, webhookSecret } = deps
  const now = deps.now ?? Date.now

  /** Same user sending the same hash again gets the first payout back. */
  function replay(existing: PayoutWithAccount, userId: string) {
    if (existing.userId !== userId) {
      throw conflict('PAYOUT_EXISTS', 'This transfer was already cashed out')
    }
    return { created: false, payout: toPayoutDto(existing) }
  }

  return {
    async create(user: { id: string; address: Address }, input: CreatePayoutInput, log: Log) {
      if (!transfers.payoutAddress || !cipher) {
        throw new AppError(503, 'PAYOUTS_UNAVAILABLE', 'Cash-out is not configured')
      }
      const existing = await repo.findByTxHash(input.txHash)
      if (existing) return replay(existing, user.id)

      const account = await repo.findBankAccount(input.bankAccountId, user.id)
      if (!account) throw notFound('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found')

      const transfer = await transfers.check(input.txHash, user.address).catch((err) => {
        log.error({ err, txHash: input.txHash }, 'could not read payout transfer')
        throw new AppError(502, 'CHAIN_UNAVAILABLE', 'Could not check the transfer, try again')
      })
      if (transfer.status === 'pending') {
        throw conflict('TX_PENDING', 'The transfer is not confirmed yet, try again in a moment')
      }
      if (transfer.status === 'reverted') throw badRequest('TX_FAILED', 'The transfer failed')
      if (transfer.amount === 0n) {
        throw badRequest(
          'TX_NOT_A_PAYOUT',
          'This transaction did not send tokens from your account to the payout address',
        )
      }

      // Display-grade rate (PLAN §3.2), recorded with its source so the UI can say so.
      const quote = await fx.usdIdr()
      const amountIdr = Math.floor((Number(transfer.amount) / UNITS_PER_USD) * quote.rate)

      const payout = await repo.create({
        userId: user.id,
        bankAccountId: account.id,
        sourceTxHash: input.txHash,
        amountUnits: transfer.amount.toString(),
        amountIdr,
        fxRate: quote.rate,
        fxSource: quote.source,
        provider: provider.name,
      })
      if (!payout) {
        const raced = await repo.findByTxHash(input.txHash)
        if (raced) return replay(raced, user.id)
        throw new Error('Payout vanished after a unique conflict')
      }

      try {
        const started = await provider.createDisbursement({
          reference: payout.id,
          bankCode: account.bankCode,
          accountNumber: cipher.decrypt(account.numberEncrypted, user.id),
          accountName: account.accountName,
          amountIdr,
        })
        return {
          created: true,
          payout: toPayoutDto(await repo.markStarted(payout.id, started.ref, started.status)),
        }
      } catch (err) {
        // The tokens already arrived, so the payout is kept (FAILED) for the team to settle by hand.
        log.error({ err, payoutId: payout.id }, 'disbursement could not be started')
        const failed = await repo.markFailed(payout.id, 'The bank transfer could not be started')
        return { created: true, payout: toPayoutDto(failed) }
      }
    },

    async list(userId: string, page: PageQuery) {
      return toPage(await repo.list(userId, page), page.limit, toPayoutDto)
    },

    /** Asks the provider for news while the payout is in flight; webhooks may never come. */
    async get(id: string, log: Log) {
      const payout = await repo.findById(id)
      if (!payout) throw payoutNotFound()
      if (payout.status !== 'PROCESSING' || !payout.providerRef) return toPayoutDto(payout)

      const status = await provider.fetchStatus(payout.providerRef).catch((err) => {
        log.warn({ err, payoutId: id }, 'could not refresh payout status')
        return 'PROCESSING' as const
      })
      if (status === 'PROCESSING') return toPayoutDto(payout)
      const reason = status === 'FAILED' ? 'The bank rejected the transfer' : undefined
      await repo.finish(payout.providerRef, status, reason)
      return toPayoutDto((await repo.findById(id))!)
    },

    /** Throws 401 unless the request carries a fresh, valid signature over the raw body. */
    verifyWebhook(rawBody: string | undefined, timestamp: unknown, signature: unknown) {
      if (!webhookSecret) {
        throw new AppError(503, 'WEBHOOK_UNAVAILABLE', 'Payout webhook is not configured')
      }
      const invalid = () => unauthorized('Invalid webhook signature')
      if (rawBody === undefined || typeof timestamp !== 'string' || typeof signature !== 'string') {
        throw invalid()
      }
      const age = now() / 1000 - Number(timestamp)
      if (!/^\d+$/.test(timestamp) || Math.abs(age) > WEBHOOK_MAX_AGE_SECONDS) throw invalid()

      const expected = Buffer.from(signWebhook(webhookSecret, timestamp, rawBody))
      const given = Buffer.from(signature)
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw invalid()
    },

    async applyWebhook(input: {
      providerRef: string
      status: 'COMPLETED' | 'FAILED'
      failureReason?: string
    }) {
      const found = await repo.finish(input.providerRef, input.status, input.failureReason)
      if (!found) throw payoutNotFound()
    },
  }
}

export type PayoutService = ReturnType<typeof createPayoutService>
