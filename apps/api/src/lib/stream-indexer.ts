import type { FastifyBaseLogger } from 'fastify'
import { parseAbi, type Address, type PublicClient } from 'viem'
import type { StreamRow, StreamStore } from './stream-store.js'

const payrollAbi = parseAbi([
  'function nextStreamId() view returns (uint256)',
  'function getStream(uint256 streamId) view returns ((address employer, uint40 start, uint40 end, bool canceled, address worker, uint128 amount, uint128 withdrawn, uint128 refunded))',
])

/** Streams read per multicall. Keeps each eth_call well under RPC gas and size limits. */
const BATCH = 100

interface Options {
  client: Pick<PublicClient, 'readContract' | 'multicall'>
  payroll: Address
  store: StreamStore
}

/**
 * Mirrors TricklePayroll streams into Postgres by reading contract state, not
 * events: stream ids are sequential (`nextStreamId`), so a sync is one call for
 * the counter plus one multicall per 100 streams. Scanning `StreamCreated` logs
 * instead would take hundreds of requests, since the public Monad RPC limits
 * `eth_getLogs` to 100 blocks. Reading state also needs no block checkpoint and
 * is not affected by reorgs.
 */
export function createStreamIndexer({ client, payroll, store }: Options) {
  /** Reads `ids` from the contract and stores them. Returns the fresh rows. */
  async function refresh(ids: bigint[]): Promise<StreamRow[]> {
    const rows: StreamRow[] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const streams = await client.multicall({
        allowFailure: false,
        contracts: batch.map((id) => ({
          address: payroll,
          abi: payrollAbi,
          functionName: 'getStream' as const,
          args: [id] as const,
        })),
      })
      rows.push(...streams.map((s, j) => toRow(batch[j]!, s)))
    }
    await store.upsert(rows)
    return rows
  }

  /** Stores streams created since the last sync. Returns how many were new. */
  async function syncNew() {
    const next = await client.readContract({
      address: payroll,
      abi: payrollAbi,
      functionName: 'nextStreamId',
    })
    const ids: bigint[] = []
    for (let id = (await store.maxId()) + 1n; id < next; id++) ids.push(id)
    await refresh(ids)
    return ids.length
  }

  return {
    refresh,
    syncNew,

    /** One full round: new streams, then every stream that can still change. */
    async sync() {
      const created = await syncNew()
      const open = await store.openIds()
      await refresh(open)
      return { created, refreshed: open.length }
    },

    /**
     * Whether a stream from `employer` to `worker` is neither canceled nor ended.
     * Picks candidates from the cache, then re-reads them on-chain, so a stream
     * canceled a moment ago does not block anything until the next round.
     */
    async hasActiveStream(employer: Address, worker: Address, now = new Date()) {
      await syncNew()
      const candidates = await store.activeIds(
        employer.toLowerCase() as Address,
        worker.toLowerCase() as Address,
        now,
      )
      if (candidates.length === 0) return false
      const fresh = await refresh(candidates)
      return fresh.some((s) => !s.canceled && s.endsAt > now)
    },
  }
}

export type StreamIndexer = ReturnType<typeof createStreamIndexer>

interface OnChainStream {
  employer: Address
  start: number
  end: number
  canceled: boolean
  worker: Address
  amount: bigint
  withdrawn: bigint
  refunded: bigint
}

function toRow(id: bigint, s: OnChainStream): StreamRow {
  return {
    id,
    employer: s.employer.toLowerCase() as Address,
    worker: s.worker.toLowerCase() as Address,
    amountUnits: s.amount.toString(),
    withdrawnUnits: s.withdrawn.toString(),
    refundedUnits: s.refunded.toString(),
    startsAt: new Date(s.start * 1000),
    endsAt: new Date(s.end * 1000),
    canceled: s.canceled,
    settled: s.withdrawn + s.refunded === s.amount,
  }
}

/**
 * Runs `indexer.sync()` every `seconds`, starting right away. A round never
 * overlaps the previous one; failures are logged and retried next round.
 * Returns a function that stops the loop.
 */
export function startStreamSync(
  indexer: Pick<StreamIndexer, 'sync'>,
  seconds: number,
  log: Pick<FastifyBaseLogger, 'info' | 'warn'>,
) {
  let running = false
  const round = async () => {
    if (running) return
    running = true
    try {
      const { created } = await indexer.sync()
      if (created > 0) log.info({ created }, 'stream indexer stored new streams')
    } catch (err) {
      log.warn({ err }, 'stream indexer round failed')
    } finally {
      running = false
    }
  }
  void round()
  const timer = setInterval(round, seconds * 1000)
  timer.unref()
  return () => clearInterval(timer)
}
