import { parseAbi, type Address, type PublicClient } from 'viem'

/** A worker's on-chain split: `bps` (0–10000) of each withdrawal goes to `recipient`. */
export interface Split {
  recipient: Address
  bps: number
}

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
  /** The worker's split, or `null` when the payroll contract is not configured. */
  splitOf(worker: Address): Promise<Split | null>
}

const payrollAbi = parseAbi([
  'function splitOf(address worker) view returns (address recipient, uint16 bps)',
])

interface Options {
  client?: Pick<PublicClient, 'readContract'>
  /** TricklePayroll address; without it `splitOf` answers `null`. */
  payroll?: Address
}

/**
 * `splitOf` is a single view call, so it reads the contract directly.
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
    async splitOf(worker) {
      if (!client || !payroll) return null
      const [recipient, bps] = await client.readContract({
        address: payroll,
        abi: payrollAbi,
        functionName: 'splitOf',
        args: [worker],
      })
      return { recipient: recipient.toLowerCase() as Address, bps }
    },
  }
}
