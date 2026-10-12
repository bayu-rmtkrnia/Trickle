import { parseAbi, type Address, type PublicClient } from 'viem'
import type { StreamIndexer } from './stream-indexer.js'

/**
 * Read-only view of the payroll contract (PLAN §4.2: money lives on the
 * contract, never in Postgres). The API only asks what it needs to refuse a
 * delete. Tests swap in a fake through `buildApp({ streams })`.
 */
export interface StreamReader {
  /** `true` when a stream from `employer` to `worker` is neither canceled nor ended. */
  hasActiveStream(employer: Address, worker: Address): Promise<boolean>
  /** `false` when `hasActiveStream` cannot check (no payroll contract); surfaced in logs. */
  readonly verified: boolean
  /**
   * Share (bps, 0–10000) of each of `worker`'s withdrawals that goes to `recipient`,
   * or `null` when the payroll contract is not configured.
   */
  splitBpsOf(worker: Address, recipient: Address): Promise<number | null>
}

const payrollAbi = parseAbi([
  'function splitBpsOf(address worker, address recipient) view returns (uint16)',
])

interface Options {
  client?: Pick<PublicClient, 'readContract'>
  /** TricklePayroll address; without it `splitBpsOf` answers `null`. */
  payroll?: Address
  /** Answers `hasActiveStream`. Without it, no stream counts as active. */
  indexer?: Pick<StreamIndexer, 'hasActiveStream'>
}

/**
 * `splitBpsOf` is a single view call, so it reads the contract directly. A
 * worker may split to several recipients (TricklePayroll v2), so it asks about
 * one recipient instead of reading the whole list.
 *
 * `hasActiveStream` goes through the stream indexer, since the contract has
 * no "streams of a worker" view. Without a payroll contract there is nothing
 * to index: it reports no active streams and `verified` is `false`.
 */
export function createStreamReader({ client, payroll, indexer }: Options = {}): StreamReader {
  return {
    verified: indexer !== undefined,
    async hasActiveStream(employer, worker) {
      return indexer ? indexer.hasActiveStream(employer, worker) : false
    },
    async splitBpsOf(worker, recipient) {
      if (!client || !payroll) return null
      return client.readContract({
        address: payroll,
        abi: payrollAbi,
        functionName: 'splitBpsOf',
        args: [worker, recipient],
      })
    },
  }
}
