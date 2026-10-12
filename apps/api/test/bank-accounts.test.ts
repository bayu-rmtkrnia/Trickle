import { describe, expect, it, vi } from 'vitest'
import type { BankAccount } from '../src/generated/prisma/client.js'
import { createFieldCipher } from '../src/lib/crypto.js'
import type { BankAccountRepository } from '../src/modules/bank-accounts/repository.js'
import { createBankAccountService } from '../src/modules/bank-accounts/service.js'

const cipher = createFieldCipher('ab'.repeat(32))
const input = {
  bankCode: 'BCA' as const,
  accountNumber: '1234567890',
  accountName: 'Aminah',
}

const row = (over: Partial<BankAccount> = {}): BankAccount => ({
  id: 'bank-1',
  userId: 'user-1',
  bankCode: 'BCA',
  accountName: 'Aminah',
  label: null,
  numberEncrypted: 'v1.x.y.z',
  numberLast4: '7890',
  numberFingerprint: 'fp',
  createdAt: new Date('2026-10-12T00:00:00Z'),
  updatedAt: new Date('2026-10-12T00:00:00Z'),
  deletedAt: null,
  ...over,
})

function setup(repo: Partial<BankAccountRepository>, withCipher = true) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createBankAccountService({
    cipher: withCipher ? cipher : undefined,
    repo: {
      findOwnerId: unexpected,
      findActive: unexpected,
      findByFingerprint: unexpected,
      countActive: unexpected,
      upsert: unexpected,
      update: unexpected,
      softDelete: unexpected,
      list: unexpected,
      ...repo,
    } as BankAccountRepository,
  })
}

describe('bank account service: create', () => {
  it('stores only the encrypted number and the last 4 digits', async () => {
    const upsert = vi.fn(async () => row())
    const s = setup({ findByFingerprint: async () => null, countActive: async () => 0, upsert })

    const dto = await s.create('user-1', input)

    const [userId, fingerprint, data] = upsert.mock.calls[0] as unknown as Parameters<
      BankAccountRepository['upsert']
    >
    expect(userId).toBe('user-1')
    expect(fingerprint).toBe(cipher.fingerprint('BCA:1234567890'))
    expect(data.numberLast4).toBe('7890')
    expect(data.numberEncrypted).not.toContain('1234567890')
    expect(cipher.decrypt(data.numberEncrypted, 'user-1')).toBe('1234567890')
    expect(JSON.stringify(dto)).not.toContain('1234567890')
    expect(dto.accountNumberLast4).toBe('7890')
  })

  it('answers 409 for an account already added', async () => {
    const s = setup({ findByFingerprint: async () => ({ id: 'bank-1', deletedAt: null }) })
    await expect(s.create('user-1', input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'BANK_ACCOUNT_EXISTS',
    })
  })

  it('restores an account that was removed', async () => {
    const upsert = vi.fn(async () => row())
    const s = setup({
      findByFingerprint: async () => ({ id: 'bank-1', deletedAt: new Date() }),
      countActive: async () => 0,
      upsert,
    })
    await s.create('user-1', input)
    expect(upsert).toHaveBeenCalledOnce()
  })

  it('answers 409 past the limit', async () => {
    const s = setup({ findByFingerprint: async () => null, countActive: async () => 5 })
    await expect(s.create('user-1', input)).rejects.toMatchObject({
      statusCode: 409,
      code: 'BANK_ACCOUNT_LIMIT',
    })
  })

  it('answers 503 when no encryption key is configured', async () => {
    const s = setup({}, false)
    await expect(s.create('user-1', input)).rejects.toMatchObject({
      statusCode: 503,
      code: 'BANK_ACCOUNTS_UNAVAILABLE',
    })
  })
})

describe('bank account service: by id', () => {
  it('answers 404 if the account vanished', async () => {
    const s = setup({ findActive: async () => null })
    await expect(s.get('bank-1')).rejects.toMatchObject({ statusCode: 404 })
    await expect(s.remove('bank-1')).rejects.toMatchObject({ statusCode: 404 })
  })
})
