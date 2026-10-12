import type { Address } from 'viem'
import type { Split } from './split'

export interface StreamSnapshot {
  id: bigint
  employer: Address
  worker: Address
  amount: bigint
  withdrawn: bigint
  refunded: bigint
  start: bigint
  end: bigint
  canceled: boolean
}
export interface WorkerSnapshot {
  streams: StreamSnapshot[]
  /** `splitsOf(worker)`: up to `MAX_RECIPIENTS` family recipients, validated. */
  splits: readonly Split[]
  walletBalance: bigint
  blockNumber: bigint
  blockTimestamp: bigint
  blockHash: string
  tokenSymbol: string
}
export class ChainReadError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ChainReadError'
  }
}
