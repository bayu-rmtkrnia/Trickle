import { describe, expect, it } from 'vitest'
import { formatToken } from '@/lib/chain/format-token'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import {
  bankCopy,
  familyDashboardCopy,
  invitationCopy as familyInvitation,
} from '@/lib/copy/family'
import { payoutCopy, payoutMessage } from '@/lib/copy/family-payout'
import { payrollCopy } from '@/lib/copy/payroll'
import { withdrawCopy, withdrawalMessage } from '@/lib/copy/withdraw'
import { invitationCopy as workerInvitation } from '@/lib/copy/worker'
import { workerDashboardCopy } from '@/lib/copy/worker-dashboard'
import { splitTxMessage, workerFamilyCopy } from '@/lib/copy/worker-family'
import { formatIdrUnits, formatRate } from '@/lib/family-money'

/** Semua jalur kunci (termasuk kunci di dalam objek), untuk membandingkan id dan en. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  )
}

const dictionaries = {
  workerDashboardCopy,
  payrollCopy,
  withdrawCopy,
  workerInvitation,
  workerFamilyCopy,
  familyInvitation,
  familyDashboardCopy,
  bankCopy,
  payoutCopy,
}

describe('worker and family dictionaries', () => {
  it.each(Object.entries(dictionaries))('%s has the same keys in id and en', (_, dict) => {
    expect(keyPaths(dict.en).sort()).toEqual(keyPaths(dict.id).sort())
  })

  it.each(Object.entries(dictionaries))('%s has no empty English text', (_, dict) => {
    const empty = keyPaths(dict.en).filter((path) => {
      const value = path
        .split('.')
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], dict.en)
      return typeof value === 'string' && value.trim() === ''
    })
    expect(empty).toEqual([])
  })
})

describe('number formats follow the language', () => {
  it('formats token amounts', () => {
    const units = BigInt(1_234_500_000)
    expect(formatToken(units, 6)).toBe('1.234,5')
    expect(formatToken(units, 6, 'en')).toBe('1,234.5')
  })

  it('formats rupiah and the exchange rate', () => {
    expect(formatIdrUnits(BigInt(1_234_567))).toBe('Rp1.234.567')
    expect(formatIdrUnits(BigInt(1_234_567), 'en')).toBe('Rp1,234,567')
    expect(formatRate(16250.5, 'en')).toBe('16,250.5')
  })
})

describe('error messages follow the language', () => {
  const gas = new WithdrawalError('GAS_INSUFFICIENT')

  it('keeps Indonesian as the default', () => {
    expect(withdrawalMessage(gas)).toMatch(/^Gas wallet belum cukup/)
    expect(payoutMessage(gas)).toMatch(/^Gas wallet belum cukup/)
    expect(splitTxMessage(gas)).toMatch(/^Gas wallet belum cukup/)
  })

  it('answers in English when asked', () => {
    expect(withdrawalMessage(gas, 'en')).toMatch(/^Not enough gas/)
    expect(payoutMessage(gas, 'en')).toMatch(/^Not enough gas/)
    expect(splitTxMessage(gas, 'en')).toMatch(/^Not enough gas/)
    expect(withdrawalMessage(new Error('boom'), 'en')).toMatch(/^The service or network/)
  })
})
