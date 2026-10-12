import { parseAbi, type Address, type PublicClient } from 'viem'

/**
 * Read-only view of the payroll contract (PLAN §4.2: money lives on the
 * contract, never in Postgres). The API only asks what it needs to refuse a
 * delete. Tests swap in a fake through `buildApp({ streams })`.
 */
export interface StreamReader {
  /** `true` when a stream from `employer` to `worker` is neither canceled nor ended. */
  hasActiveStream(employer: Address, worker: Address): Promise<boolean>
  /** `false` while `hasActiveStream` is a placeholder; surfaced in logs and docs. */
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
}

/**
 * `splitBpsOf` is a single view call, so it reads the contract directly. A
 * worker may split to several recipients (TricklePayroll v2), so it asks about
 * one recipient instead of reading the whole list.
 *
 * `hasActiveStream` is a placeholder until the stream indexer exists: the
 * contract has no "streams of a worker" view, and the public Monad RPC limits
 * `eth_getLogs` to 100 blocks, so scanning `StreamCreated` events per request
 * is not viable. It reports no active streams, so deletes are not blocked.
 */
export function createStreamReader({ client, payroll }: Options = {}): StreamReader {
  return {
    verified: false,
    async hasActiveStream() {
      return false
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
