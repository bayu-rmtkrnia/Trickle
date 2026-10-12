import { getAddress, type Address, type Hex } from 'viem'
import { isApiError } from '@/lib/api/errors'
import type { PayoutDto } from '@/lib/api/payouts'
import { payrollConfig, type PayrollConfig } from './config'
import type { WithdrawalRequest } from './payroll-writer'
import type { PayoutStore, PendingFamilyPayout } from './payout-storage'
import { PayoutError, type PayoutWriter } from './payout-writer'
import { isRejected } from './withdrawal-coordinator'

export type PayoutPhase =
  | 'idle'
  | 'confirming'
  | 'signing'
  | 'transfer-pending'
  | 'submission-unknown'
  | 'registration-pending'
  | 'processing'
  | 'completed'
  | 'transfer-failed'
  | 'payout-failed'

export interface FamilyPayoutState {
  phase: PayoutPhase
  amountUnits: bigint | null
  bankAccountId: string | null
  /** Token transfer hash once known. Proof of the transfer, not of the bank leg. */
  hash: Hex | null
  payout: PayoutDto | null
  error: unknown
  checking: boolean
  /**
   * The stored recovery record is corrupt or belongs to another chain/token,
   * so it cannot be verified. Only `discardUnreadable` can clear it.
   */
  unreadable: boolean
}

export interface PayoutCoordinatorDeps {
  wallet: Address
  /** `null` when `NEXT_PUBLIC_PAYOUT_ADDRESS` is not configured: submit stays off. */
  destination: Address | null
  writer: Pick<
    PayoutWriter,
    'prepare' | 'settle' | 'submissionBlock' | 'submissionNonce' | 'canAbandon'
  >
  store: PayoutStore
  send(request: WithdrawalRequest): Promise<{ hash: Hex }>
  isCurrent(): boolean
  /** Re-checks the recipient role and that the bank account still exists. */
  checkReady(bankAccountId: string, signal?: AbortSignal): Promise<void>
  /** `POST /payouts` with a fresh session token. */
  register(input: { txHash: Hex; bankAccountId: string }): Promise<PayoutDto>
  onTransferred?(): void
  signal?: AbortSignal
  config?: PayrollConfig
  newId?(): string
  now?(): number
  /** How long a signature lease lasts without renewal (default 30 s). */
  leaseMs?: number
}

const LEASE_MS = 30_000

/** Registration answers that will not change by retrying the same hash. */
const FINAL_REGISTRATION = ['TX_FAILED', 'TX_NOT_A_PAYOUT', 'PAYOUT_EXISTS']
const HASH = /^0x[0-9a-fA-F]{64}$/

export function statusPhase(payout: PayoutDto): PayoutPhase {
  if (payout.status === 'COMPLETED') return 'completed'
  if (payout.status === 'FAILED') return 'payout-failed'
  return 'processing'
}

export class PayoutCoordinator {
  private state: FamilyPayoutState = {
    phase: 'idle',
    amountUnits: null,
    bankAccountId: null,
    hash: null,
    payout: null,
    error: null,
    checking: false,
    unreadable: false,
  }
  private listeners = new Set<() => void>()
  private busy = false
  private marker: PendingFamilyPayout | null = null
  private readonly config: PayrollConfig

  constructor(private deps: PayoutCoordinatorDeps) {
    this.config = deps.config ?? payrollConfig
    try {
      const pending = deps.store.read()
      if (pending) this.restore(pending)
    } catch (error) {
      // Unreadable or foreign record: a transfer may exist, so block new ones.
      this.state = {
        ...this.state,
        phase: 'submission-unknown',
        error,
        unreadable: true,
        hash: deps.store.salvageHash(),
      }
    }
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  /** True while a transfer may exist that is not registered yet. */
  get recovering() {
    return ['transfer-pending', 'submission-unknown', 'registration-pending'].includes(
      this.state.phase,
    )
  }

  private update(patch: Partial<FamilyPayoutState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private restore(pending: PendingFamilyPayout) {
    this.marker = pending
    this.state = {
      ...this.state,
      phase: pending.txHash ? 'transfer-pending' : 'submission-unknown',
      amountUnits: BigInt(pending.amountUnits),
      bankAccountId: pending.bankAccountId,
      hash: pending.txHash,
    }
  }
  private ownsMarker() {
    const stored = this.deps.store.read()
    return !!this.marker && !!stored && stored.attemptId === this.marker.attemptId
  }
  private save(patch: Partial<PendingFamilyPayout>) {
    if (!this.marker || !this.ownsMarker()) throw new PayoutError('PENDING_CHANGED')
    this.marker = { ...this.marker, ...patch }
    this.deps.store.write(this.marker)
  }
  private clearOwnMarker() {
    if (!this.ownsMarker()) return false
    this.deps.store.write(null)
    this.marker = null
    return true
  }
  private get leaseMs() {
    return this.deps.leaseMs ?? LEASE_MS
  }
  private now() {
    return this.deps.now?.() ?? Date.now()
  }
  private leaseDeadline() {
    return String(this.now() + this.leaseMs)
  }
  private renewLease() {
    try {
      if (this.marker && !this.marker.txHash && this.ownsMarker())
        this.save({ leaseUntil: this.leaseDeadline() })
    } catch {
      /* The lease lapses on its own; the signature result is still handled. */
    }
  }
  /**
   * Records a hash the wallet returned. A real transaction must never lose
   * its record: if this tab's marker vanished, it is written back; if another
   * attempt replaced it, the hash is still shown and recovery is required.
   */
  private keepHash(hash: Hex) {
    const stored = this.deps.store.read()
    if (this.marker && stored?.attemptId === this.marker.attemptId) {
      this.save({ txHash: hash, leaseUntil: null })
      return
    }
    if (this.marker && !stored) {
      this.marker = { ...this.marker, txHash: hash, leaseUntil: null }
      this.deps.store.write(this.marker)
      return
    }
    this.update({ hash })
    throw new PayoutError('PENDING_CHANGED')
  }

  start() {
    if (this.busy || this.state.phase !== 'idle' || !this.deps.destination) return
    this.update({ phase: 'confirming', error: null, payout: null, hash: null })
  }
  cancel() {
    if (!this.busy && this.state.phase === 'confirming')
      this.update({ phase: 'idle', error: null, amountUnits: null, bankAccountId: null })
  }

  async submit(input: { amountUnits: bigint; bankAccountId: string }) {
    const destination = this.deps.destination
    if (
      this.busy ||
      this.state.phase !== 'confirming' ||
      !destination ||
      input.amountUnits <= BigInt(0) ||
      !input.bankAccountId ||
      !this.deps.isCurrent()
    )
      return
    this.busy = true
    let sending = false
    try {
      this.update({
        checking: true,
        error: null,
        amountUnits: input.amountUnits,
        bankAccountId: input.bankAccountId,
      })
      await this.deps.checkReady(input.bankAccountId, this.deps.signal)
      const request = await this.deps.writer.prepare(
        this.deps.wallet,
        destination,
        input.amountUnits,
        this.deps.signal,
      )
      const afterBlock = (await this.deps.writer.submissionBlock()).toString()
      const nonce = (await this.deps.writer.submissionNonce(this.deps.wallet)).toString()
      if (!this.deps.isCurrent()) return
      const existing = this.deps.store.read()
      if (existing) {
        this.restore(existing)
        this.update({})
        return
      }
      const marker: PendingFamilyPayout = {
        version: 1,
        attemptId: this.deps.newId?.() ?? crypto.randomUUID(),
        wallet: getAddress(this.deps.wallet),
        chainId: this.config.chainId,
        token: getAddress(this.config.tokenAddress),
        destination,
        amountUnits: input.amountUnits.toString(),
        bankAccountId: input.bankAccountId,
        txHash: null,
        nonce,
        submittedAtBlock: afterBlock,
        payoutId: null,
        leaseUntil: this.leaseDeadline(),
      }
      // Saved before the signature so a lost response still blocks a second transfer.
      this.deps.store.write(marker)
      this.marker = marker
      sending = true
      this.update({ phase: 'signing', checking: false })
      // The lease tells other tabs this signature is still outstanding; the
      // pinned nonce means two signatures of one attempt cannot both be mined.
      const renew = setInterval(() => this.renewLease(), this.leaseMs / 3)
      let hash: Hex
      try {
        ;({ hash } = await this.deps.send({ ...request, nonce: BigInt(nonce) }))
      } finally {
        clearInterval(renew)
      }
      if (!HASH.test(hash)) throw new PayoutError('INVALID_HASH')
      this.keepHash(hash)
      this.update({ phase: 'transfer-pending', hash })
      await this.wait(hash)
    } catch (error) {
      // Raised by the wallet adapter before anything is broadcast (any error class).
      const code = (error as { code?: unknown } | null)?.code
      const beforeSubmission =
        typeof code === 'string' && ['WALLET_CHANGED', 'WALLET_NOT_READY'].includes(code)
      if (sending && !isRejected(error) && !beforeSubmission) {
        // The wallet call has ended (with an unknown outcome): release the
        // lease so recovery can reconcile it, but keep the record.
        try {
          if (this.marker && !this.marker.txHash && this.ownsMarker())
            this.save({ leaseUntil: null })
        } catch {
          /* The lease simply expires. */
        }
        this.update({ phase: 'submission-unknown', error, checking: false })
      } else {
        try {
          if (sending) this.clearOwnMarker()
          this.update({ phase: 'confirming', error, checking: false })
        } catch (cleanupError) {
          this.update({ phase: 'submission-unknown', error: cleanupError, checking: false })
        }
      }
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }

  private async wait(hash: Hex) {
    const marker = this.marker!
    try {
      const transfer = await this.deps.writer.settle(
        this.deps.wallet,
        marker.destination,
        BigInt(marker.amountUnits),
        hash,
        marker.submittedAtBlock ? BigInt(marker.submittedAtBlock) : undefined,
      )
      if (marker.txHash !== transfer.hash) this.save({ txHash: transfer.hash })
      if (!this.deps.isCurrent()) return
      this.update({ hash: transfer.hash })
      try {
        this.deps.onTransferred?.()
      } catch {
        /* A balance refresh failure does not change the transfer. */
      }
      await this.register()
    } catch (error) {
      const final = error instanceof PayoutError && ['REVERTED', 'REPLACED'].includes(error.code)
      try {
        if (final) this.clearOwnMarker()
        if (this.deps.isCurrent())
          this.update({ phase: final ? 'transfer-failed' : 'submission-unknown', error })
      } catch (cleanupError) {
        if (this.deps.isCurrent()) this.update({ phase: 'submission-unknown', error: cleanupError })
      }
    }
  }

  /** Registers the known hash. Never sends another transfer. */
  private async register() {
    const marker = this.marker
    if (!marker?.txHash) throw new PayoutError('PENDING_CHANGED')
    this.update({ phase: 'registration-pending', checking: true, error: null })
    try {
      const payout = await this.deps.register({
        txHash: marker.txHash,
        bankAccountId: marker.bankAccountId,
      })
      if (payout.sourceTxHash.toLowerCase() !== marker.txHash.toLowerCase())
        throw new PayoutError('PAYOUT_MISMATCH')
      this.clearOwnMarker()
      if (!this.deps.isCurrent()) return
      this.update({ phase: statusPhase(payout), payout, error: null, checking: false })
    } catch (error) {
      if (!this.deps.isCurrent()) return
      const final = isApiError(error) && FINAL_REGISTRATION.includes(error.code ?? '')
      this.update({
        phase: final ? 'payout-failed' : 'registration-pending',
        error,
        checking: false,
      })
    }
  }

  /**
   * Re-reads this attempt from storage so a hash or lease written by another
   * tab is seen before acting on it.
   */
  private refreshMarker() {
    const stored = this.deps.store.read()
    if (this.marker && stored?.attemptId === this.marker.attemptId) this.marker = stored
    return stored
  }

  /** Checks a submitted (or user-supplied) hash, then registers it. */
  async resume(candidate?: Hex) {
    if (
      this.busy ||
      !this.deps.isCurrent() ||
      !['transfer-pending', 'submission-unknown'].includes(this.state.phase)
    )
      return
    try {
      this.refreshMarker()
    } catch (error) {
      this.update({ error })
      return
    }
    const target = candidate ?? this.marker?.txHash ?? this.state.hash
    if (!target || !HASH.test(target)) {
      this.update({ error: new PayoutError('INVALID_HASH') })
      return
    }
    if (!this.marker) {
      this.update({ error: new PayoutError('STORAGE_UNAVAILABLE') })
      return
    }
    this.busy = true
    try {
      this.update({ phase: 'transfer-pending', hash: target, checking: true, error: null })
      await this.wait(target)
    } catch (error) {
      this.update({ phase: 'submission-unknown', error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }

  async retryRegistration() {
    if (this.busy || this.state.phase !== 'registration-pending' || !this.deps.isCurrent()) return
    this.busy = true
    try {
      await this.register()
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }

  /** After the user confirms: register the same hash to another of their accounts. */
  async changeBank(bankAccountId: string) {
    if (
      this.busy ||
      this.state.phase !== 'registration-pending' ||
      !bankAccountId ||
      !this.deps.isCurrent()
    )
      return
    this.busy = true
    try {
      this.save({ bankAccountId })
      this.update({ bankAccountId })
      await this.register()
    } catch (error) {
      this.update({ error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }

  /**
   * Clears a never-signed attempt. Requires all of: no hash recorded, no live
   * signature lease from any tab, and the nonce check showing nothing used the
   * pinned nonce. An unchanged nonce alone is not proof: a wallet prompt may
   * still be open, which is what the lease covers.
   */
  async abandon() {
    if (
      this.busy ||
      !this.deps.isCurrent() ||
      this.state.phase !== 'submission-unknown' ||
      this.state.hash !== null ||
      !this.marker
    )
      return
    this.busy = true
    this.update({ checking: true, error: null })
    try {
      const stored = this.refreshMarker()
      if (!stored || stored.attemptId !== this.marker.attemptId)
        throw new PayoutError('PENDING_CHANGED')
      if (stored.txHash) {
        // Another tab got the hash meanwhile: follow it instead of abandoning.
        this.restore(stored)
        this.update({})
        return
      }
      if (stored.leaseUntil && Number(stored.leaseUntil) > this.now())
        throw new PayoutError('SIGNATURE_PENDING')
      if (
        !stored.nonce ||
        !stored.submittedAtBlock ||
        !(await this.deps.writer.canAbandon(
          this.deps.wallet,
          BigInt(stored.nonce),
          BigInt(stored.submittedAtBlock),
        )) ||
        !this.deps.isCurrent()
      )
        throw new PayoutError('RECOVERY_UNVERIFIED')
      // Re-check after the RPC round trip: the lease or hash may have changed.
      const after = this.refreshMarker()
      if (
        !after ||
        after.attemptId !== stored.attemptId ||
        after.txHash ||
        (after.leaseUntil && Number(after.leaseUntil) > this.now())
      )
        throw new PayoutError('PENDING_CHANGED')
      if (!this.clearOwnMarker()) throw new PayoutError('PENDING_CHANGED')
      this.update({ phase: 'idle', amountUnits: null, bankAccountId: null, hash: null })
    } catch (error) {
      this.update({ phase: 'submission-unknown', error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }

  /**
   * Clears an unreadable record after the user confirmed they checked their
   * wallet activity in the explorer. Nothing here can verify it automatically,
   * and readable records never go through this path.
   */
  discardUnreadable(confirmed: boolean) {
    if (this.busy || !confirmed || !this.state.unreadable || this.marker) return
    try {
      this.deps.store.discard()
    } catch (error) {
      this.update({ error })
      return
    }
    this.update({
      phase: 'idle',
      amountUnits: null,
      bankAccountId: null,
      hash: null,
      payout: null,
      error: null,
      unreadable: false,
    })
  }

  /** Leaves a finished or failed result. The tokens and payout record stay as they are. */
  dismiss() {
    if (
      this.busy ||
      !['processing', 'completed', 'transfer-failed', 'payout-failed'].includes(this.state.phase)
    )
      return
    try {
      if (this.marker) this.clearOwnMarker()
    } catch (error) {
      this.update({ error })
      return
    }
    this.update({
      phase: 'idle',
      amountUnits: null,
      bankAccountId: null,
      hash: null,
      payout: null,
      error: null,
    })
  }
}
