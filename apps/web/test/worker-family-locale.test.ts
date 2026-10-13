import { describe, expect, it } from 'vitest'
import { workerFamilyDictionary } from '@/lib/copy/worker-family'
import { payrollDictionary } from '@/lib/copy/payroll'
import { withdrawDictionary } from '@/lib/copy/withdraw'
import { bankDictionary } from '@/lib/copy/family'
import { payoutDictionary } from '@/lib/copy/family-payout'
import { formatToken } from '@/lib/chain/format-token'
import { formatIdrUnits } from '@/lib/family-money'

describe('worker and family language packs', () => {
  it('translates the main form and transaction controls into English', () => {
    expect(workerFamilyDictionary.en.splitSheet.save).toBe('Save split')
    expect(workerFamilyDictionary.en.inviteSheet.submit).toBe('Create invitation link')
    expect(payrollDictionary.en.detailsTitle).toBe('Fund details')
    expect(withdrawDictionary.en.confirm).toBe('Confirm withdrawal')
    expect(bankDictionary.en.form.save).toBe('Save bank account')
    expect(payoutDictionary.en.confirm).toBe('Send and cash out')
    expect(payoutDictionary.en.history.title).toBe('Payout history')
  })

  it('formats token and rupiah amounts without losing bigint precision', () => {
    expect(formatToken(BigInt('1234567890123456789'), 6, 'id')).toBe('1.234.567.890.123,456789')
    expect(formatToken(BigInt('1234567890123456789'), 6, 'en')).toBe('1,234,567,890,123.456789')
    expect(formatIdrUnits(BigInt('1234567890123456789'), 'en')).toBe('Rp1,234,567,890,123,456,789')
  })
})
