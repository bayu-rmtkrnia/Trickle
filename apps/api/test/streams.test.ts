import { describe, expect, it, vi } from 'vitest'
import { createStreamReader } from '../src/lib/streams.js'

const payroll = '0xE7292E797009E9D53102ec132Ef4Ae549cDD652e'

describe('stream reader', () => {
  it('reads splitOf from the payroll contract and lowercases the recipient', async () => {
    const readContract = vi.fn(async () => ['0xAbC0000000000000000000000000000000000001', 3000])
    const reader = createStreamReader({ client: { readContract } as never, payroll })
    await expect(reader.splitOf('0xsiti')).resolves.toEqual({
      recipient: '0xabc0000000000000000000000000000000000001',
      bps: 3000,
    })
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: payroll, functionName: 'splitOf', args: ['0xsiti'] }),
    )
  })

  it('answers null without a payroll address, and no active streams until the indexer exists', async () => {
    const reader = createStreamReader()
    await expect(reader.splitOf('0xsiti')).resolves.toBeNull()
    await expect(reader.hasActiveStream('0xboss', '0xsiti')).resolves.toBe(false)
    expect(reader.verified).toBe(false)
  })
})
