import { describe, expect, it, vi } from 'vitest'
import type { Payout } from '../src/generated/prisma/client.js'
import { createFieldCipher } from '../src/lib/crypto.js'
import type { FxService } from '../src/lib/fx.js'
import type { PayoutProvider } from '../src/lib/payout-provider.js'
import type { TransferCheck, TransferVerifier } from '../src/lib/transfers.js'
import type { PayoutRepository } from '../src/modules/payouts/repository.js'
import type { PayoutWithAccount } from '../src/modules/payouts/schemas.js'
import { createPayoutService, signWebhook } from '../src/modules/payouts/service.js'

const cipher = createFieldCipher('ab'.repeat(32))
const user = { id: 'ibu', address: '0x00000000000000000000000000000000000000e5' } as const
const txHash = `0x${'11'.repeat(32)}` as const
const input = { txHash, bankAccountId: 'bank-1' }
const log = { error: vi.fn(), warn: vi.fn() }
const secret = 's'.repeat(32)
const NOW = 1_760_000_000_000

const account = {
  id: 'bank-1',
  bankCode: 'BCA',
  accountName: 'Aminah',
  numberEncrypted: cipher.encrypt('1234567890', 'ibu'),
}

const row = (over: Partial<Payout> = {}): PayoutWithAccount => ({
  id: 'payout-1',
  userId: 'ibu',
  bankAccountId: 'bank-1',
  sourceTxHash: txHash,
  amountUnits: '50000000',
  amountIdr: 820_000,
  fxRate: 16_400,
  fxSource: 'live',
  provider: 'mock',
  providerRef: null,
  status: 'PENDING',
  failureReason: null,
  createdAt: new Date('2026-10-12T00:00:00Z'),
  updatedAt: new Date('2026-10-12T00:00:00Z'),
  bankAccount: { id: 'bank-1', bankCode: 'BCA', numberLast4: '7890' },
  ...over,
})

interface Setup {
  repo?: Partial<PayoutRepository>
  check?: TransferVerifier['check']
  provider?: Partial<PayoutProvider>
  configured?: boolean
}

function setup({ repo = {}, check, provider = {}, configured = true }: Setup) {
  const unexpected = () => {
    throw new Error('unexpected call')
  }
  return createPayoutService({
    now: () => NOW,
    cipher: configured ? cipher : undefined,
    webhookSecret: configured ? secret : undefined,
    fx: {
      usdIdr: async () => ({
        base: 'USD',
        quote: 'IDR',
        rate: 16_400,
        source: 'live',
        rateTime: null,
        fetchedAt: null,
      }),
    } as FxService,
    transfers: {
      payoutAddress: configured ? '0x00000000000000000000000000000000000000d4' : undefined,
      check: check ?? unexpected,
    },
    provider: {
      name: 'mock',
      createDisbursement: unexpected,
      fetchStatus: unexpected,
      ...provider,
    },
    repo: {
      findOwnerId: unexpected,
      findById: unexpected,
      findByTxHash: async () => null,
      findBankAccount: async () => account,
      create: unexpected,
      markStarted: unexpected,
      markFailed: unexpected,
      finish: unexpected,
      list: unexpected,
      ...repo,
    } as PayoutRepository,
  })
}

const transferred =
  (result: TransferCheck): TransferVerifier['check'] =>
  async () =>
    result

describe('payout service: create', () => {
  it('verifies the transfer, converts to IDR and starts the disbursement', async () => {
    const create = vi.fn(async () => row())
    const createDisbursement = vi.fn<PayoutProvider['createDisbursement']>(async () => ({
      ref: 'mock_1',
      status: 'PROCESSING',
    }))
    const s = setup({
      check: transferred({ status: 'ok', amount: 50_000_000n }),
      repo: {
        create,
        markStarted: async (_id, providerRef, status) => row({ providerRef, status }),
      },
      provider: { createDisbursement },
    })

    const res = await s.create(user, input, log)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amountUnits: '50000000', amountIdr: 820_000, fxSource: 'live' }),
    )
    // The provider is the only place the full number goes, decrypted for this call.
    expect(createDisbursement).toHaveBeenCalledWith(
      expect.objectContaining({ reference: 'payout-1', accountNumber: '1234567890' }),
    )
    expect(res.created).toBe(true)
    expect(res.payout).toMatchObject({ status: 'PROCESSING', amountUsd: '50', testMode: true })
    expect(JSON.stringify(res.payout)).not.toContain('1234567890')
  })

  it('returns the first payout when the same user sends the hash again', async () => {
    const s = setup({ repo: { findByTxHash: async () => row({ status: 'COMPLETED' }) } })
    await expect(s.create(user, input, log)).resolves.toMatchObject({
      created: false,
      payout: { status: 'COMPLETED' },
    })
  })

  it('answers 409 when another user already cashed out this transfer', async () => {
    const s = setup({ repo: { findByTxHash: async () => row({ userId: 'someone-else' }) } })
    await expect(s.create(user, input, log)).rejects.toMatchObject({ code: 'PAYOUT_EXISTS' })
  })

  it.each([
    [{ status: 'pending' } as const, 409, 'TX_PENDING'],
    [{ status: 'reverted' } as const, 400, 'TX_FAILED'],
    [{ status: 'ok', amount: 0n } as const, 400, 'TX_NOT_A_PAYOUT'],
  ])('refuses a transfer that is %o', async (result, statusCode, code) => {
    const s = setup({ check: transferred(result) })
    await expect(s.create(user, input, log)).rejects.toMatchObject({ statusCode, code })
  })

  it('answers 502 when the chain cannot be read', async () => {
    const s = setup({ check: async () => Promise.reject(new Error('rpc down')) })
    await expect(s.create(user, input, log)).rejects.toMatchObject({
      statusCode: 502,
      code: 'CHAIN_UNAVAILABLE',
    })
  })

  it('answers 404 for a bank account that is not mine', async () => {
    const s = setup({ repo: { findBankAccount: async () => null } })
    await expect(s.create(user, input, log)).rejects.toMatchObject({
      statusCode: 404,
      code: 'BANK_ACCOUNT_NOT_FOUND',
    })
  })

  it('keeps the payout as FAILED when the provider refuses to start', async () => {
    const markFailed = vi.fn(async (_id: string, failureReason: string) =>
      row({ status: 'FAILED', failureReason }),
    )
    const s = setup({
      check: transferred({ status: 'ok', amount: 1_000_000n }),
      repo: { create: async () => row(), markFailed },
      provider: { createDisbursement: async () => Promise.reject(new Error('sandbox down')) },
    })
    const res = await s.create(user, input, log)
    expect(res.payout).toMatchObject({ status: 'FAILED' })
    expect(markFailed).toHaveBeenCalledOnce()
  })

  it('answers 503 when payouts are not configured', async () => {
    const s = setup({ configured: false })
    await expect(s.create(user, input, log)).rejects.toMatchObject({
      statusCode: 503,
      code: 'PAYOUTS_UNAVAILABLE',
    })
  })
})

describe('payout service: get', () => {
  it('asks the provider while the payout is in flight', async () => {
    const finish = vi.fn<PayoutRepository['finish']>(async () => true)
    let current = row({ status: 'PROCESSING', providerRef: 'mock_1' })
    const s = setup({
      repo: {
        findById: async () => current,
        finish: async (...args) => {
          current = row({ status: 'COMPLETED', providerRef: 'mock_1' })
          return finish(...args)
        },
      },
      provider: { fetchStatus: async () => 'COMPLETED' },
    })
    await expect(s.get('payout-1', log)).resolves.toMatchObject({ status: 'COMPLETED' })
    expect(finish).toHaveBeenCalledWith('mock_1', 'COMPLETED', undefined)
  })

  it('does not call the provider for a finished payout', async () => {
    const s = setup({ repo: { findById: async () => row({ status: 'COMPLETED' }) } })
    await expect(s.get('payout-1', log)).resolves.toMatchObject({ status: 'COMPLETED' })
  })
})

describe('payout service: webhook', () => {
  const body = JSON.stringify({ providerRef: 'mock_1', status: 'COMPLETED' })
  const ts = String(NOW / 1000)

  it('accepts a fresh, correctly signed request', () => {
    const s = setup({})
    expect(() => s.verifyWebhook(body, ts, signWebhook(secret, ts, body))).not.toThrow()
  })

  it.each([
    ['a wrong signature', body, ts, signWebhook('x'.repeat(32), ts, body)],
    ['a changed body', body.replace('COMPLETED', 'FAILED'), ts, signWebhook(secret, ts, body)],
    [
      'a stale timestamp',
      body,
      String(NOW / 1000 - 301),
      signWebhook(secret, String(NOW / 1000 - 301), body),
    ],
    ['no signature', body, ts, undefined],
  ])('refuses %s with 401', (_label, raw, timestamp, signature) => {
    const s = setup({})
    expect(() => s.verifyWebhook(raw, timestamp, signature)).toThrow(
      expect.objectContaining({ statusCode: 401 }),
    )
  })

  it('answers 503 without a secret', () => {
    const s = setup({ configured: false })
    expect(() => s.verifyWebhook(body, ts, 'x')).toThrow(
      expect.objectContaining({ statusCode: 503, code: 'WEBHOOK_UNAVAILABLE' }),
    )
  })

  it('answers 404 for an unknown reference', async () => {
    const s = setup({ repo: { finish: async () => false } })
    await expect(
      s.applyWebhook({ providerRef: 'nope', status: 'COMPLETED' }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})
