import { describe, expect, it, vi } from 'vitest'
import { createStreamReader } from '../src/lib/streams.js'

const payroll = '0xE7292E797009E9D53102ec132Ef4Ae549cDD652e'

describe('stream reader', () => {
  it('reads splitBpsOf for one recipient from the payroll contract', async () => {
    const readContract = vi.fn(async () => 3000)
    const reader = createStreamReader({ client: { readContract } as never, payroll })
    await expect(reader.splitBpsOf('0xsiti', '0xibu')).resolves.toBe(3000)
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: payroll,
        functionName: 'splitBpsOf',
        args: ['0xsiti', '0xibu'],
      }),
    )
  })

  it('answers null and no active streams without a payroll contract', async () => {
    const reader = createStreamReader()
    await expect(reader.splitBpsOf('0xsiti', '0xibu')).resolves.toBeNull()
    await expect(reader.hasActiveStream('0xboss', '0xsiti')).resolves.toBe(false)
    expect(reader.verified).toBe(false)
  })

  it('asks the stream indexer whether a stream is active', async () => {
    const hasActiveStream = vi.fn(async () => true)
    const reader = createStreamReader({ payroll, indexer: { hasActiveStream, syncNew: vi.fn() } })
    await expect(reader.hasActiveStream('0xboss', '0xsiti')).resolves.toBe(true)
    expect(hasActiveStream).toHaveBeenCalledWith('0xboss', '0xsiti')
    expect(reader.verified).toBe(true)
  })
})
