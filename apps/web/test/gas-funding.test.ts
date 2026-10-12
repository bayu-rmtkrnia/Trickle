import { describe, expect, it, vi } from 'vitest'
import { confirmGasFunding } from '@/lib/chain/gas-funding'
import type { GasDrip } from '@/lib/api/gas'

const hash = `0x${'a'.repeat(64)}` as const
const drip = (status: GasDrip['status'], txHash: GasDrip['txHash']): GasDrip => ({
  address: '0x2222222222222222222222222222222222222222',
  status,
  amountMon: '0.05',
  txHash,
  alreadyDripped: status !== 'SENT',
  createdAt: '2026-10-12T00:00:00Z',
})

describe('gas funding before withdrawal', () => {
  it('polls a pending drip and waits for its confirmed receipt', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(drip('PENDING', null))
      .mockResolvedValueOnce(drip('SENT', hash))
    const receipt = vi.fn().mockResolvedValue('success')
    await confirmGasFunding(request, receipt, { delay: async () => undefined })
    expect(request).toHaveBeenCalledTimes(2)
    expect(receipt).toHaveBeenCalledExactlyOnceWith(hash)
  })

  it('does not allow signing while a drip remains pending', async () => {
    const request = vi.fn().mockResolvedValue(drip('PENDING', null))
    const receipt = vi.fn()
    await expect(
      confirmGasFunding(request, receipt, { delay: async () => undefined, attempts: 3 }),
    ).rejects.toMatchObject({ code: 'GAS_PENDING' })
    expect(request).toHaveBeenCalledTimes(3)
    expect(receipt).not.toHaveBeenCalled()
  })

  it('rejects a reverted gas transfer', async () => {
    await expect(
      confirmGasFunding(
        async () => drip('SENT', hash),
        async () => 'reverted',
      ),
    ).rejects.toMatchObject({ code: 'GAS_FAILED' })
  })

  it('checks an existing SENT drip without requesting new gas', async () => {
    const existing = { ...drip('SENT', hash), alreadyDripped: true }
    const request = vi.fn().mockResolvedValue(existing)
    const receipt = vi.fn().mockResolvedValue('success')
    await confirmGasFunding(request, receipt)
    expect(request).toHaveBeenCalledOnce()
    expect(receipt).toHaveBeenCalledExactlyOnceWith(hash)
  })
})
