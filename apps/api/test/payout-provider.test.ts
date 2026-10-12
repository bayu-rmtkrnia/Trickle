import { describe, expect, it } from 'vitest'
import { createMockPayoutProvider } from '../src/lib/payout-provider.js'

const input = {
  reference: 'payout-1',
  bankCode: 'BCA',
  accountNumber: '1234567890',
  accountName: 'Aminah',
  amountIdr: 820_000,
}

describe('mock payout provider', () => {
  it('processes, then completes after the configured delay', async () => {
    let t = 1_000_000
    const p = createMockPayoutProvider({ completeAfterSeconds: 15, now: () => t })
    const { ref, status } = await p.createDisbursement(input)
    expect(status).toBe('PROCESSING')
    expect(ref).not.toContain(input.accountNumber)

    t += 14_000
    await expect(p.fetchStatus(ref)).resolves.toBe('PROCESSING')
    t += 1_000
    await expect(p.fetchStatus(ref)).resolves.toBe('COMPLETED')
  })

  it('rejects accounts ending in 0000, like provider test numbers', async () => {
    const p = createMockPayoutProvider({ completeAfterSeconds: 0 })
    const { ref } = await p.createDisbursement({ ...input, accountNumber: '9876540000' })
    await expect(p.fetchStatus(ref)).resolves.toBe('FAILED')
  })

  it('refuses references it did not issue', async () => {
    const p = createMockPayoutProvider({ completeAfterSeconds: 0 })
    await expect(p.fetchStatus('xendit_123')).rejects.toThrow(/Unknown reference/)
  })
})
