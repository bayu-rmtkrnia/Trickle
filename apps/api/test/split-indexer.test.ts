import { describe, expect, it, vi } from 'vitest'
import { createSplitIndexer, LOG_RANGE, startSplitSync } from '../src/lib/split-indexer.js'
import type { ScanCursor, SplitPaymentRow, SplitStore } from '../src/lib/split-store.js'

const payroll = '0xE7292E797009E9D53102ec132Ef4Ae549cDD652e'
const SITI = '0x00000000000000000000000000000000000000A1'
const IBU = '0x00000000000000000000000000000000000000F1'

interface FakeLog {
  block: bigint
  amount: bigint
}

/** Fake chain with `SplitPaid` logs at given blocks, and an in-memory store. */
function setup({
  head,
  logs = [],
  backfillBlocks = 0n,
  requestsPerRound = 10,
  cursor = null,
}: {
  head: bigint
  logs?: FakeLog[]
  backfillBlocks?: bigint
  requestsPerRound?: number
  cursor?: ScanCursor | null
}) {
  const chain = { head }
  const ranges: [bigint, bigint][] = []
  const getLogs = vi.fn(async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
    if (toBlock - fromBlock + 1n > LOG_RANGE) throw new Error('block range too large')
    ranges.push([fromBlock, toBlock])
    return logs
      .filter((l) => l.block >= fromBlock && l.block <= toBlock)
      .map((l, i) => ({
        removed: false,
        blockNumber: l.block,
        transactionHash: `0x${l.block.toString(16).padStart(64, '0')}`,
        logIndex: i,
        args: { streamId: 7n, worker: SITI, recipient: IBU, amount: l.amount },
      }))
  })
  const getBlock = vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
    timestamp: 1_800_000_000n + blockNumber,
  }))
  const state = { cursor, rows: [] as SplitPaymentRow[] }
  const store: SplitStore = {
    cursor: async () => state.cursor,
    save: async (rows, next) => {
      state.rows.push(...rows)
      state.cursor = next
    },
  }
  const indexer = createSplitIndexer({
    client: { getBlockNumber: async () => chain.head, getLogs, getBlock } as never,
    payroll,
    store,
    backfillBlocks,
    requestsPerRound,
  })
  return { indexer, state, ranges, chain, getBlock }
}

describe('split indexer', () => {
  it('starts at the head minus confirmations and fills history below it, newest range first', async () => {
    const { indexer, state, ranges } = setup({
      head: 1_002n,
      backfillBlocks: 250n,
      logs: [{ block: 900n, amount: 5_000_000n }],
    })
    const result = await indexer.sync()
    // Head 1002 minus 2 confirmations = 1000. Floor = 1000 + 1 - 250 = 751.
    expect(ranges).toEqual([
      [901n, 1_000n],
      [801n, 900n],
      [751n, 800n],
    ])
    expect(state.cursor).toEqual({ forwardBlock: 1_000n, backfillBlock: 751n, floorBlock: 751n })
    expect(result).toMatchObject({ stored: 1, requests: 3, behind: 0n, backfillLeft: 0n })
    expect(state.rows).toEqual([
      {
        txHash: `0x${(900).toString(16).padStart(64, '0')}`,
        logIndex: 0,
        blockNumber: 900n,
        paidAt: new Date((1_800_000_000 + 900) * 1000),
        streamId: 7n,
        worker: SITI.toLowerCase(),
        recipient: IBU.toLowerCase(),
        amountUnits: '5000000',
      },
    ])
  })

  it('follows the head in 100-block ranges before spending the rest on the backfill', async () => {
    const { indexer, state, ranges, chain } = setup({
      head: 0n,
      requestsPerRound: 3,
      cursor: { forwardBlock: 1_000n, backfillBlock: 500n, floorBlock: 0n },
    })
    chain.head = 1_252n
    await indexer.sync()
    expect(ranges).toEqual([
      [1_001n, 1_100n],
      [1_101n, 1_200n],
      [1_201n, 1_250n],
    ])
    expect(state.cursor).toEqual({ forwardBlock: 1_250n, backfillBlock: 500n, floorBlock: 0n })
    await indexer.sync()
    expect(ranges.slice(3)).toEqual([
      [400n, 499n],
      [300n, 399n],
      [200n, 299n],
    ])
  })

  it('catch-up only reads new blocks and never the backfill', async () => {
    const { indexer, ranges } = setup({
      head: 1_102n,
      cursor: { forwardBlock: 1_000n, backfillBlock: 500n, floorBlock: 0n },
    })
    await indexer.catchUp()
    expect(ranges).toEqual([[1_001n, 1_100n]])
  })

  it('keeps the cursor when a read fails, so the range is read again next round', async () => {
    const cursor = { forwardBlock: 1_000n, backfillBlock: 1_001n, floorBlock: 1_001n }
    const { indexer, state } = setup({ head: 1_052n, cursor })
    const failing = createSplitIndexer({
      client: {
        getBlockNumber: async () => 1_052n,
        getLogs: async () => {
          throw new Error('rpc down')
        },
        getBlock: async () => ({ timestamp: 0n }),
      } as never,
      payroll,
      store: { cursor: async () => state.cursor, save: async () => undefined },
      backfillBlocks: 0n,
      requestsPerRound: 5,
    })
    await expect(failing.sync()).rejects.toThrow('rpc down')
    expect(state.cursor).toEqual(cursor)
    await indexer.sync()
    expect(state.cursor?.forwardBlock).toBe(1_050n)
  })

  it('runs one scan at a time so two scans never write the same cursor', async () => {
    const { indexer, ranges } = setup({
      head: 1_102n,
      cursor: { forwardBlock: 1_000n, backfillBlock: 1_001n, floorBlock: 1_001n },
    })
    await Promise.all([indexer.sync(), indexer.catchUp()])
    expect(ranges).toEqual([[1_001n, 1_100n]])
  })

  it('fetches each block time once', async () => {
    const { indexer, getBlock } = setup({
      head: 1_102n,
      cursor: { forwardBlock: 1_000n, backfillBlock: 1_001n, floorBlock: 1_001n },
      logs: [
        { block: 1_050n, amount: 1n },
        { block: 1_050n, amount: 2n },
      ],
    })
    await indexer.sync()
    expect(getBlock).toHaveBeenCalledOnce()
  })
})

describe('split sync loop', () => {
  it('logs failures and keeps going', async () => {
    const log = { info: vi.fn(), warn: vi.fn() }
    const sync = vi.fn(async () => {
      throw new Error('rpc down')
    })
    const stop = startSplitSync({ sync }, 60, log)
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalledOnce())
    stop()
  })
})
