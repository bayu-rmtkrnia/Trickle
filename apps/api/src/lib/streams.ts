import type { Address } from 'viem'

/**
 * Read-only view of payroll streams on-chain (PLAN §4.2: money lives on the
 * contract, never in Postgres). The API only asks one question: is this
 * employer still streaming to this worker? Tests swap in a fake through
 * `buildApp({ streams })`.
 */
export interface StreamReader {
  /** `true` when a stream from `employer` to `worker` is neither canceled nor ended. */
  hasActiveStream(employer: Address, worker: Address): Promise<boolean>
  /** `false` while the answer is a placeholder; surfaced in logs and docs. */
  readonly verified: boolean
}

/**
 * Placeholder until the stream indexer exists. The public Monad RPC limits
 * `eth_getLogs` to 100 blocks, so scanning `StreamCreated` events per request
 * is not viable; the indexer (owned by SC) will answer this instead.
 * It reports no active streams, so deletes are not blocked.
 */
export function createUnverifiedStreamReader(): StreamReader {
  return {
    verified: false,
    async hasActiveStream() {
      return false
    },
  }
}
