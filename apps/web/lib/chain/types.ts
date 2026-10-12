import type { Address } from 'viem'

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
  split: { recipient: Address; bps: number }
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
