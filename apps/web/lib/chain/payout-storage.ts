import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { payrollConfig, type PayrollConfig } from './config'
import { PayoutError } from './payout-writer'

/**
 * Public recovery record for one family payout. It never holds an account
 * number or session token; `bankAccountId` is the server id only.
 */
export interface PendingFamilyPayout {
  version: 1
  attemptId: string
  wallet: Address
  chainId: number
  token: Address
  destination: Address
  /** Token base units as a decimal string. */
  amountUnits: string
  bankAccountId: string
  txHash: Hex | null
  nonce: string | null
  submittedAtBlock: string | null
  payoutId: string | null
  /**
   * Epoch ms until which a tab is still waiting for the wallet signature of
   * this attempt. Renewed by that tab; other tabs must not abandon before it
   * lapses. `null` once the signature result is known.
   */
  leaseUntil: string | null
}
export interface PayoutStore {
  /** Throws `PENDING_MISMATCH` for a record from another chain/token/wallet. */
  read(): PendingFamilyPayout | null
  write(value: PendingFamilyPayout | null): void
  /** Best-effort hash from an unreadable record, for the explorer link only. */
  salvageHash(): Hex | null
  /** Removes the raw record even when it cannot be parsed. */
  discard(): void
}

const digits = (value: unknown, max = 78) =>
  typeof value === 'string' && new RegExp(`^\\d{1,${max}}$`).test(value)
const nullable = (value: unknown, check: (v: unknown) => boolean) => value === null || check(value)
const hash = (value: unknown) => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)

export function payoutStorageKey(wallet: string, config: PayrollConfig = payrollConfig) {
  return `trickle:family-payout:${config.chainId}:${config.tokenAddress.toLowerCase()}:${wallet.toLowerCase()}`
}

export function pendingPayoutStore(
  wallet: Address,
  config: PayrollConfig = payrollConfig,
  storage: () => Storage | null = () =>
    typeof window === 'undefined' ? null : window.localStorage,
): PayoutStore {
  const key = payoutStorageKey(wallet, config)
  return {
    read() {
      const store = storage()
      if (!store) return null
      let value: Record<string, unknown>
      try {
        const raw = store.getItem(key)
        if (raw === null) return null
        value = JSON.parse(raw) as Record<string, unknown>
      } catch {
        throw new PayoutError('STORAGE_UNAVAILABLE')
      }
      if (
        !value ||
        value.version !== 1 ||
        !id(value.attemptId) ||
        typeof value.wallet !== 'string' ||
        !isAddress(value.wallet) ||
        typeof value.token !== 'string' ||
        !isAddress(value.token) ||
        typeof value.destination !== 'string' ||
        !isAddress(value.destination) ||
        typeof value.chainId !== 'number' ||
        !digits(value.amountUnits) ||
        value.amountUnits === '0' ||
        !id(value.bankAccountId) ||
        !nullable(value.txHash, hash) ||
        !nullable(value.nonce, digits) ||
        !nullable(value.submittedAtBlock, digits) ||
        !nullable(value.payoutId, id) ||
        !(value.leaseUntil === undefined || nullable(value.leaseUntil, (v) => digits(v, 16)))
      )
        throw new PayoutError('STORAGE_UNAVAILABLE')
      // Keyed per wallet already; a record that disagrees is never resumed.
      if (
        getAddress(value.wallet) !== getAddress(wallet) ||
        value.chainId !== config.chainId ||
        getAddress(value.token) !== getAddress(config.tokenAddress)
      )
        throw new PayoutError('PENDING_MISMATCH')
      return {
        version: 1,
        attemptId: value.attemptId as string,
        wallet: getAddress(value.wallet),
        chainId: value.chainId,
        token: getAddress(value.token),
        destination: getAddress(value.destination),
        amountUnits: value.amountUnits as string,
        bankAccountId: value.bankAccountId as string,
        txHash: (value.txHash as Hex | null) ?? null,
        nonce: (value.nonce as string | null) ?? null,
        submittedAtBlock: (value.submittedAtBlock as string | null) ?? null,
        payoutId: (value.payoutId as string | null) ?? null,
        leaseUntil: (value.leaseUntil as string | null | undefined) ?? null,
      }
    },
    write(next) {
      const store = storage()
      if (!store) throw new PayoutError('STORAGE_UNAVAILABLE')
      try {
        if (next === null) store.removeItem(key)
        else store.setItem(key, JSON.stringify(next))
      } catch {
        throw new PayoutError('STORAGE_UNAVAILABLE')
      }
    },
    salvageHash() {
      try {
        const raw = storage()?.getItem(key)
        const match = raw ? /0x[0-9a-fA-F]{64}/.exec(raw) : null
        return match ? (match[0] as Hex) : null
      } catch {
        return null
      }
    },
    discard() {
      const store = storage()
      if (!store) throw new PayoutError('STORAGE_UNAVAILABLE')
      try {
        store.removeItem(key)
      } catch {
        throw new PayoutError('STORAGE_UNAVAILABLE')
      }
    },
  }
}
