import type { Address } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { createStreamIndexer, startStreamSync } from '../src/lib/stream-indexer.js'
import type { StreamRow, StreamStore } from '../src/lib/stream-store.js'

const payroll = '0xd24dD0Bda442808a58c26689168e44185BE04584'
const BOSS = '0x00000000000000000000000000000000000000B0' as Address
const SITI = '0x00000000000000000000000000000000000000A1' as Address
const NOW = new Date('2026-10-13T00:00:00Z')
const sec = (d: Date) => d.getTime() / 1000

interface Chain {
  employer: Address
  worker: Address
  start: number
  end: number
  canceled: boolean
  amount: bigint
  withdrawn: bigint
  refunded: bigint
}

const stream = (over: Partial<Chain> = {}): Chain => ({
  employer: BOSS,
  worker: SITI,
  start: sec(NOW) - 3600,
  end: sec(NOW) + 3600,
  canceled: false,
  amount: 1000n,
  withdrawn: 0n,
  refunded: 0n,
  ...over,
})

/** Fake contract (`chain[i]` is stream id i + 1) and an in-memory store. */
function setup(chain: Chain[]) {
  const readContract = vi.fn(async () => BigInt(chain.length + 1))
  const multicall = vi.fn(async ({ contracts }: { contracts: { args: [bigint] }[] }) =>
    contracts.map(({ args: [id] }) => chain[Number(id) - 1]),
  )
  const rows = new Map<bigint, StreamRow>()
  const store: StreamStore = {
    maxId: async () => [...rows.keys()].reduce((a, b) => (b > a ? b : a), 0n),
    openIds: async () => [...rows.values()].filter((r) => !r.settled).map((r) => r.id),
    activeIds: async (employer, worker, now) =>
      [...rows.values()]
        .filter((r) => r.employer === employer && r.worker === worker)
        .filter((r) => !r.canceled && r.endsAt > now)
        .map((r) => r.id),
    upsert: async (list) => list.forEach((r) => rows.set(r.id, r)),
  }
  const indexer = createStreamIndexer({
    client: { readContract, multicall } as never,
    payroll,
    store,
  })
  return { indexer, rows, multicall }
}

describe('stream indexer', () => {
  it('stores new streams with lowercased addresses and unit strings', async () => {
    const { indexer, rows } = setup([stream({ withdrawn: 250n })])
    await expect(indexer.sync()).resolves.toEqual({ created: 1, refreshed: 1 })
    expect(rows.get(1n)).toEqual({
      id: 1n,
      employer: BOSS.toLowerCase(),
      worker: SITI.toLowerCase(),
      amountUnits: '1000',
      withdrawnUnits: '250',
      refundedUnits: '0',
      startsAt: new Date(NOW.getTime() - 3_600_000),
      endsAt: new Date(NOW.getTime() + 3_600_000),
      canceled: false,
      settled: false,
    })
  })

  it('only fetches ids above the last stored one, and stops re-reading settled streams', async () => {
    const chain = [stream({ canceled: true, withdrawn: 400n, refunded: 600n }), stream()]
    const { indexer, multicall } = setup(chain)
    await indexer.sync()
    multicall.mockClear()

    chain.push(stream())
    await expect(indexer.sync()).resolves.toEqual({ created: 1, refreshed: 2 })
    const asked = multicall.mock.calls.flatMap(([c]) => c.contracts.map((x) => x.args[0]))
    expect(asked).toEqual([3n, 2n, 3n])
  })

  it('reads at most 100 streams per multicall', async () => {
    const { indexer, multicall } = setup(Array.from({ length: 250 }, () => stream()))
    await indexer.syncNew()
    expect(multicall.mock.calls.map(([c]) => c.contracts.length)).toEqual([100, 100, 50])
  })

  it('reports an active stream, re-reading it on-chain first', async () => {
    const chain = [stream()]
    const { indexer } = setup(chain)
    await indexer.sync()
    await expect(indexer.hasActiveStream(BOSS, SITI, NOW)).resolves.toBe(true)

    // Canceled after the last round: the re-read catches it.
    chain[0] = stream({ canceled: true, refunded: 500n })
    await expect(indexer.hasActiveStream(BOSS, SITI, NOW)).resolves.toBe(false)
  })

  it('picks up a stream created since the last round', async () => {
    const chain: Chain[] = []
    const { indexer } = setup(chain)
    await indexer.sync()
    chain.push(stream())
    await expect(indexer.hasActiveStream(BOSS, SITI, NOW)).resolves.toBe(true)
  })

  it('ignores ended streams and other pairs', async () => {
    const { indexer, multicall } = setup([
      stream({ end: sec(NOW) - 1 }),
      stream({ worker: '0x00000000000000000000000000000000000000c3' }),
    ])
    await indexer.sync()
    multicall.mockClear()
    await expect(indexer.hasActiveStream(BOSS, SITI, NOW)).resolves.toBe(false)
    expect(multicall).not.toHaveBeenCalled()
  })

  it('counts a stream that has not started yet as active', async () => {
    const { indexer } = setup([stream({ start: sec(NOW) + 60, end: sec(NOW) + 3600 })])
    await expect(indexer.hasActiveStream(BOSS, SITI, NOW)).resolves.toBe(true)
  })
})

describe('stream sync loop', () => {
  it('runs right away, logs failures and keeps going', async () => {
    vi.useFakeTimers()
    try {
      const sync = vi
        .fn()
        .mockRejectedValueOnce(new Error('rpc down'))
        .mockResolvedValue({ created: 2, refreshed: 0 })
      const log = { info: vi.fn(), warn: vi.fn() }
      const stop = startStreamSync({ sync }, 15, log)
      await vi.advanceTimersByTimeAsync(0)
      expect(log.warn).toHaveBeenCalledOnce()

      await vi.advanceTimersByTimeAsync(15_000)
      expect(log.info).toHaveBeenCalledWith({ created: 2 }, expect.any(String))

      stop()
      await vi.advanceTimersByTimeAsync(60_000)
      expect(sync).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips a round while the previous one is still running', async () => {
    vi.useFakeTimers()
    try {
      let finish = () => {}
      const sync = vi.fn(
        () =>
          new Promise<{ created: number; refreshed: number }>(
            (r) => (finish = () => r({ created: 0, refreshed: 0 })),
          ),
      )
      const stop = startStreamSync({ sync }, 15, { info: vi.fn(), warn: vi.fn() })
      await vi.advanceTimersByTimeAsync(45_000)
      expect(sync).toHaveBeenCalledOnce()
      finish()
      await vi.advanceTimersByTimeAsync(15_000)
      expect(sync).toHaveBeenCalledTimes(2)
      stop()
    } finally {
      vi.useRealTimers()
    }
  })
})
