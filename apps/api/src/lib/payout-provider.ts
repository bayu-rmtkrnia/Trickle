import { randomUUID } from 'node:crypto'

export type DisbursementStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface DisbursementInput {
  /** Our payout id, so the provider's records point back to it */
  reference: string
  bankCode: string
  /** Decrypted only for this call; never logged or stored by the API */
  accountNumber: string
  accountName: string
  amountIdr: number
}

/**
 * The bank leg of a payout (PLAN §3.2: sandbox, labelled "Mode uji" in the UI).
 * Xendit or Flip would implement this; for now only the mock exists (D5).
 * Tests and the app pick one through `buildApp({ payoutProvider })`.
 */
export interface PayoutProvider {
  readonly name: string
  createDisbursement(input: DisbursementInput): Promise<{ ref: string; status: DisbursementStatus }>
  /** Current status, for providers that are polled instead of (or as well as) calling the webhook. */
  fetchStatus(ref: string): Promise<DisbursementStatus>
}

interface MockOptions {
  /** A disbursement completes this long after it was created. */
  completeAfterSeconds: number
  now?: () => number
}

/**
 * Stateless stand-in for a sandbox provider: the outcome is encoded in the
 * reference, so it survives restarts and needs no table. Like the providers'
 * test numbers, accounts ending in `0000` are rejected, to demo the failure path.
 */
export function createMockPayoutProvider({
  completeAfterSeconds,
  now = Date.now,
}: MockOptions): PayoutProvider {
  return {
    name: 'mock',

    async createDisbursement(input) {
      const outcome = input.accountNumber.endsWith('0000') ? 'f' : 's'
      return {
        ref: `mock_${now()}_${outcome}_${randomUUID().slice(0, 8)}`,
        status: 'PROCESSING',
      }
    },

    async fetchStatus(ref) {
      const [prefix, createdAt, outcome] = ref.split('_')
      const started = Number(createdAt)
      if (prefix !== 'mock' || !Number.isFinite(started))
        throw new Error(`Unknown reference ${ref}`)
      if (now() - started < completeAfterSeconds * 1000) return 'PROCESSING'
      return outcome === 'f' ? 'FAILED' : 'COMPLETED'
    },
  }
}
