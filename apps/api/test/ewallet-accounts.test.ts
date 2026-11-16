import { describe, expect, it } from 'vitest'
import {
  accountType,
  CreateBankAccountInput,
  toBankAccountDto,
} from '../src/modules/bank-accounts/schemas.js'

const base = { accountName: 'Aminah' }
const parse = (bankCode: string, accountNumber: string) =>
  CreateBankAccountInput.safeParse({ ...base, bankCode, accountNumber })

describe('e-wallet payout destinations', () => {
  it.each([
    ['0812-3456-7890', '081234567890'],
    ['+62 812 3456 7890', '081234567890'],
    ['628123456789', '08123456789'],
  ])('stores the wallet phone %s as %s', (raw, stored) => {
    const result = parse('DANA', raw)
    expect(result.success).toBe(true)
    expect(result.data?.accountNumber).toBe(stored)
  })

  it.each(['12345678', '0712345678', '08123', '0812345678901234'])(
    'rejects %s as an e-wallet phone number',
    (raw) => {
      const result = parse('GOPAY', raw)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(['accountNumber'])
    },
  )

  it('keeps bank numbers as they were', () => {
    expect(parse('BCA', '1234-567-890').data?.accountNumber).toBe('1234567890')
    expect(parse('BCA', '0812345').success).toBe(true)
    expect(parse('JAGO', '1234567890').success).toBe(false)
  })

  it('tells banks and e-wallets apart in responses', () => {
    expect(accountType('OVO')).toBe('EWALLET')
    expect(accountType('BRI')).toBe('BANK')
    const row = {
      id: 'b1',
      userId: 'u1',
      bankCode: 'SHOPEEPAY',
      accountName: 'Aminah',
      label: null,
      numberEncrypted: 'v1.x',
      numberLast4: '7890',
      numberFingerprint: 'fp',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
    }
    expect(toBankAccountDto(row)).toMatchObject({ bankCode: 'SHOPEEPAY', type: 'EWALLET' })
  })
})
