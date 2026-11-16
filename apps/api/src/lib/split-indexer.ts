import type { FastifyBaseLogger } from 'fastify'
import { parseAbiItem, type Address, type PublicClient } from 'viem'
import type { ScanCursor, SplitPaymentRow, SplitStore } from './split-store.js'

const splitPaid = parseAbiItem(
  'event SplitPaid(uint256 indexed streamId, address indexed worker, address indexed recipient, uint128 amount)',
)

/** Blocks per `eth_getLogs` request. The public Monad RPC refuses ranges above 100. */
export const LOG_RANGE = 100n
/** Blocks left unread below the head, so a log is read only once its block is final. */
const CONFIRMATIONS = 2n

interface Options {
  client: Pick<PublicClient, 'getBlockNumber' | 'getLogs' | 'getBlock'>
  payroll: Address
  store: SplitStore
  /** History filled on the first run, in blocks. */
  backfillBlocks: bigint
  /** `eth_getLogs` requests one `sync()` may send. */
  requestsPerRound: number
}

const min = (a: bigint, b: bigint) => (a < b ? a : b)
const max = (a: bigint, b: bigint) => (a > b ? a : b)

/**
 * Stores `SplitPaid` events (a worker's withdrawal paying a family member) so
 * the family can list what they received. Unlike streams, there is no contract
 * state to read instead, so this scans logs in 100-block ranges: forward from
 * where it stopped to the head, then backward once to `backfillBlocks` ago.
 * The head grows about 48 blocks per 15-second round, so following it costs
 * about one request; the rest of each round's budget goes to the backfill.
 *
 * Scans run one at a time in this process, so the cursor only moves forward.
 */
export function createSplitIndexer({
  client,
  payroll,
  store,
  backfillBlocks,
  requestsPerRound,
}: Options) {
  let queue: Promise<unknown> = Promise.resolve()
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  async function read(fromBlock: bigint, toBlock: bigint): Promise<SplitPaymentRow[]> {
    const logs = await client.getLogs({
      address: payroll,
      event: splitPaid,
      fromBlock,
      toBlock,
      strict: true,
    })
    const live = logs.filter(
      (log) =>
        !log.removed &&
        log.blockNumber !== null &&
        log.transactionHash !== null &&
        log.logIndex !== null,
    )
    // Logs carry no timestamp. A withdrawal is one block, so this is usually one call.
    const paidAt = new Map<bigint, Date>()
    for (const blockNumber of new Set(live.map((log) => log.blockNumber!))) {
      const block = await client.getBlock({ blockNumber })
      paidAt.set(blockNumber, new Date(Number(block.timestamp) * 1000))
    }
    return live.map((log) => ({
      txHash: log.transactionHash!.toLowerCase(),
      logIndex: log.logIndex!,
      blockNumber: log.blockNumber!,
      paidAt: paidAt.get(log.blockNumber!)!,
      streamId: log.args.streamId,
      worker: log.args.worker.toLowerCase(),
      recipient: log.args.recipient.toLowerCase(),
      amountUnits: log.args.amount.toString(),
    }))
  }

  async function scan(budget: number, backfill: boolean) {
    const head = (await client.getBlockNumber()) - CONFIRMATIONS
    let cursor: ScanCursor | null = await store.cursor()
    if (!cursor) {
      // First run: follow the head from here, and fill history below it.
      cursor = {
        forwardBlock: head,
        backfillBlock: head + 1n,
        floorBlock: max(0n, head + 1n - backfillBlocks),
      }
      await store.save([], cursor)
    }
    let requests = 0
    let stored = 0
    while (cursor.forwardBlock < head && requests < budget) {
      const from = cursor.forwardBlock + 1n
      const to = min(from + LOG_RANGE - 1n, head)
      const rows = await read(from, to)
      requests++
      cursor = { ...cursor, forwardBlock: to }
      await store.save(rows, cursor)
      stored += rows.length
    }
    while (backfill && cursor.backfillBlock > cursor.floorBlock && requests < budget) {
      const to = cursor.backfillBlock - 1n
      const from = max(to - LOG_RANGE + 1n, cursor.floorBlock)
      const rows = await read(from, to)
      requests++
      cursor = { ...cursor, backfillBlock: from }
      await store.save(rows, cursor)
      stored += rows.length
    }
    return {
      stored,
      requests,
      behind: head - cursor.forwardBlock,
      backfillLeft: cursor.backfillBlock - cursor.floorBlock,
    }
  }

  return {
    /** One background round: catch up with the head, then spend what is left on the backfill. */
    sync: () => exclusive(() => scan(requestsPerRound, true)),
    /** Reads only the newest blocks, for a list request that should not wait for the next round. */
    catchUp: (requests = 3) => exclusive(() => scan(requests, false)),
  }
}

export type SplitIndexer = ReturnType<typeof createSplitIndexer>

/**
 * Runs `indexer.sync()` every `seconds`, starting right away. Like the stream
 * loop: rounds never overlap, failures are logged and retried next round.
 */
export function startSplitSync(
  indexer: Pick<SplitIndexer, 'sync'>,
  seconds: number,
  log: Pick<FastifyBaseLogger, 'info' | 'warn'>,
) {
  let running = false
  let reported = false
  const round = async () => {
    if (running) return
    running = true
    try {
      const { stored, backfillLeft } = await indexer.sync()
      if (stored > 0) log.info({ stored }, 'split indexer stored family transfers')
      if (backfillLeft === 0n && !reported) {
        reported = true
        log.info('split indexer finished the backfill')
      }
    } catch (err) {
      log.warn({ err }, 'split indexer round failed')
    } finally {
      running = false
    }
  }
  void round()
  const timer = setInterval(round, seconds * 1000)
  timer.unref()
  return () => clearInterval(timer)
}
