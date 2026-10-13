import { getAddress, isAddress, type Address } from 'viem'
import { payrollConfig, type PayrollConfig } from './config'
import { validateSplits, type Split } from './split'
import { availableAt } from './stream-math'
import { ChainReadError, type StreamSnapshot, type WorkerSnapshot } from './types'

export interface ChainBlock {
  number: bigint
  timestamp: bigint
  hash: string
}
export interface CreationLog {
  streamId: bigint
  worker: Address
  blockNumber: bigint
  blockHash: string
  transactionHash: string
  logIndex: number
}
export interface ChainPort {
  chainId(): Promise<number>
  bytecode(address: Address, block: bigint): Promise<string | undefined>
  block(number?: bigint): Promise<ChainBlock>
  token(block: bigint): Promise<Address>
  decimals(block: bigint): Promise<number>
  symbol(block: bigint): Promise<string>
  nextStreamId?(block: bigint): Promise<bigint>
  logs(worker: Address, from: bigint, to: bigint): Promise<CreationLog[]>
  stream(id: bigint, block: bigint): Promise<StreamSnapshot>
  withdrawable(id: bigint, block: bigint): Promise<bigint>
  splits(worker: Address, block: bigint): Promise<readonly Split[]>
  balance(worker: Address, block: bigint): Promise<bigint>
}
type Checkpoint = {
  through: bigint
  hash: string | null
  events: Map<string, CreationLog>
  range: bigint
}
const one = BigInt(1)
function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
function matches(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase()
}
export function createPayrollReader(
  factory: (signal?: AbortSignal) => ChainPort,
  config: PayrollConfig = payrollConfig,
  options: { rangeSize?: bigint; overlap?: bigint; maxRanges?: number } = {},
) {
  const caches = new Map<string, Checkpoint>()
  const rangeSize = options.rangeSize ?? BigInt(10000)
  const overlap = options.overlap ?? BigInt(12)
  const maxRanges = options.maxRanges ?? 128
  if (rangeSize < one || overlap < one || maxRanges < 1)
    throw new RangeError('Invalid discovery limits')
  const key = (worker: Address) =>
    `${config.chainId}:${config.payrollAddress.toLowerCase()}:${worker.toLowerCase()}`
  async function verified(port: ChainPort, block: ChainBlock, signal?: AbortSignal) {
    abort(signal)
    const chain = await port.chainId()
    abort(signal)
    if (chain !== config.chainId || block.number < config.deploymentBlock)
      throw new ChainReadError('DEPLOYMENT_MISMATCH')
    const [payrollCode, tokenCode, token, decimals, symbol] = await Promise.all([
      port.bytecode(config.payrollAddress, block.number),
      port.bytecode(config.tokenAddress, block.number),
      port.token(block.number),
      port.decimals(block.number),
      port.symbol(block.number),
    ])
    abort(signal)
    if (
      !payrollCode ||
      payrollCode === '0x' ||
      !tokenCode ||
      tokenCode === '0x' ||
      !matches(token, config.tokenAddress) ||
      decimals !== config.tokenDecimals ||
      !symbol.trim()
    )
      throw new ChainReadError('DEPLOYMENT_MISMATCH')
    return symbol
  }
  async function discover(
    port: ChainPort,
    worker: Address,
    head: ChainBlock,
    signal?: AbortSignal,
  ) {
    const cacheKey = key(worker)
    let state = caches.get(cacheKey)
    if (
      state?.hash &&
      (state.through > head.number || (await port.block(state.through)).hash !== state.hash)
    )
      state = undefined
    abort(signal)
    if (!state) {
      state = {
        through: config.deploymentBlock - one,
        hash: null,
        events: new Map(),
        range: rangeSize,
      }
      if (caches.size >= 8) caches.delete(caches.keys().next().value!)
      caches.set(cacheKey, state)
    }
    let from = state.through - overlap + one
    if (from < config.deploymentBlock) from = config.deploymentBlock
    let size = state.range,
      requests = 0
    while (from <= head.number) {
      abort(signal)
      if (++requests > maxRanges) throw new ChainReadError('SCAN_INCOMPLETE')
      const to = from + size - one < head.number ? from + size - one : head.number
      let logs: CreationLog[]
      try {
        logs = await port.logs(worker, from, to)
      } catch (error) {
        abort(signal)
        if (
          size > one &&
          /eth_getLogs.*(?:limit|range)|block.*range|range.*(?:large|limit)|too many (?:results|logs)/i.test(
            String(error),
          )
        ) {
          const limit = String(error).match(/limited to (\d+) (?:block )?range/i)?.[1]
          size = limit && BigInt(limit) < size ? BigInt(limit) : size / BigInt(2)
          if (size < one) size = one
          state.range = size
          continue
        }
        throw error
      }
      abort(signal)
      const endBlock = await port.block(to)
      abort(signal)
      const validLogs = logs.filter(
        (event) =>
          matches(event.worker, worker) &&
          event.blockNumber >= from &&
          event.blockNumber <= to &&
          event.streamId >= one,
      )
      const canonicalHashes = new Map<bigint, string>([[to, endBlock.hash]])
      for (const event of validLogs) {
        let hash = canonicalHashes.get(event.blockNumber)
        if (hash === undefined) {
          hash = (await port.block(event.blockNumber)).hash
          canonicalHashes.set(event.blockNumber, hash)
        }
        abort(signal)
        if (hash !== event.blockHash) throw new ChainReadError('CHAIN_CHANGED')
      }
      for (const [id, event] of state.events)
        if (event.blockNumber >= from && event.blockNumber <= to) state.events.delete(id)
      for (const event of validLogs)
        state.events.set(`${event.transactionHash}:${event.logIndex}`, event)
      if (to >= state.through) {
        state.through = to
        state.hash = endBlock.hash
      }
      from = to + one
    }
    return [...new Set([...state.events.values()].map((event) => event.streamId))].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
  }
  async function start(worker: Address, signal?: AbortSignal) {
    abort(signal)
    if (!isAddress(worker)) throw new ChainReadError('INVALID_WALLET')
    const port = factory(signal),
      head = await port.block()
    abort(signal)
    const symbol = await verified(port, head, signal)
    const nextId = port.nextStreamId ? await port.nextStreamId(head.number) : null
    abort(signal)
    if (nextId !== null && nextId < one) throw new ChainReadError('SNAPSHOT_MISMATCH')
    // This contract starts at 1 and only increments after successful creation.
    // A counter of 1 proves no stream exists; it is not an incomplete log scan.
    if (nextId === one) caches.delete(key(worker))
    const ids = nextId === one ? [] : await discover(port, getAddress(worker), head, signal)
    return { port, head, symbol, ids }
  }
  async function stable(port: ChainPort, head: ChainBlock, signal?: AbortSignal) {
    const current = await port.block(head.number)
    abort(signal)
    if (current.hash !== head.hash) throw new ChainReadError('CHAIN_CHANGED')
  }
  async function withSafeCache<T>(worker: Address, read: () => Promise<T>): Promise<T> {
    try {
      return await read()
    } catch (error) {
      // A confirmed fork or inconsistent snapshot invalidates all cached
      // ranges. Transient RPC and bounded-scan failures remain resumable.
      if (
        error instanceof ChainReadError &&
        ['CHAIN_CHANGED', 'STREAM_OWNERSHIP', 'SNAPSHOT_MISMATCH'].includes(error.code)
      )
        caches.delete(key(worker))
      throw error
    }
  }
  async function snapshot(
    port: ChainPort,
    head: ChainBlock,
    symbol: string,
    worker: Address,
    ids: readonly bigint[],
    signal?: AbortSignal,
  ): Promise<WorkerSnapshot> {
    const streams: StreamSnapshot[] = []
    // Limit simultaneous calls independently of the number of discovered streams.
    for (let offset = 0; offset < ids.length; offset += 4) {
      abort(signal)
      const batch = await Promise.all(
        ids.slice(offset, offset + 4).map(async (id) => {
          const [stream, available] = await Promise.all([
            port.stream(id, head.number),
            port.withdrawable(id, head.number),
          ])
          abort(signal)
          if (!matches(stream.worker, worker)) throw new ChainReadError('STREAM_OWNERSHIP')
          if (availableAt(stream, head.timestamp) !== available)
            throw new ChainReadError('SNAPSHOT_MISMATCH')
          return stream
        }),
      )
      streams.push(...batch)
    }
    const [splits, walletBalance] = await Promise.all([
      port.splits(worker, head.number),
      port.balance(worker, head.number),
    ])
    abort(signal)
    if (validateSplits(splits) !== null || walletBalance < BigInt(0))
      throw new ChainReadError('SNAPSHOT_MISMATCH')
    await stable(port, head, signal)
    return {
      streams,
      splits,
      walletBalance,
      blockNumber: head.number,
      blockTimestamp: head.timestamp,
      blockHash: head.hash,
      tokenSymbol: symbol,
    }
  }
  return {
    async listWorkerStreamIds(worker: Address, signal?: AbortSignal) {
      return withSafeCache(worker, async () => {
        const { port, head, ids } = await start(worker, signal)
        await stable(port, head, signal)
        return ids
      })
    },
    async readWorkerSnapshot(worker: Address, signal?: AbortSignal): Promise<WorkerSnapshot> {
      return withSafeCache(worker, async () => {
        const { port, head, symbol, ids } = await start(worker, signal)
        return snapshot(port, head, symbol, worker, ids, signal)
      })
    },
    async readWorkerSnapshotForIds(
      worker: Address,
      indexedIds: readonly bigint[],
      signal?: AbortSignal,
    ): Promise<WorkerSnapshot> {
      return withSafeCache(worker, async () => {
        abort(signal)
        if (!isAddress(worker)) throw new ChainReadError('INVALID_WALLET')
        const ids = [...new Set(indexedIds)]
        if (ids.some((id) => id < one)) throw new ChainReadError('SNAPSHOT_MISMATCH')
        const port = factory(signal)
        const head = await port.block()
        const symbol = await verified(port, head, signal)
        return snapshot(port, head, symbol, getAddress(worker), ids, signal)
      })
    },
    clear(worker: Address) {
      caches.delete(key(worker))
    },
  }
}
