import type { Address, Hex } from 'viem'
import {
  WithdrawalError,
  type createPayrollWriter,
  type WithdrawalRequest,
  type WithdrawalResult,
} from './payroll-writer'
export interface PendingWithdrawal {
  streamId: string
  hash: Hex | null
  afterBlock?: string
  nonce?: string
  attemptId?: string
  /**
   * Epoch ms until which a tab is still waiting for the wallet signature of
   * this attempt. Renewed by that tab; other tabs must not abandon before it
   * lapses. `null` once the signature call has ended.
   */
  leaseUntil?: string | null
}
export interface WithdrawalState {
  phase: 'idle' | 'confirming' | 'signing' | 'pending' | 'success' | 'failed' | 'unknown'
  streamId: bigint | null
  hash: Hex | null
  result: WithdrawalResult | null
  error: unknown
  checking: boolean
}
export interface PendingStore {
  read(): PendingWithdrawal | null
  write(p: PendingWithdrawal | null): void
}
export interface WithdrawalDependencies {
  worker: Address
  writer: ReturnType<typeof createPayrollWriter>
  send(request: WithdrawalRequest): Promise<{ hash: Hex }>
  store: PendingStore
  isCurrent(): boolean
  onSuccess(): void
  submissionNonce?(): Promise<bigint>
  verifyAbandoned?(pending: PendingWithdrawal): Promise<boolean>
  signal?: AbortSignal
  now?(): number
  /** How long a signature lease lasts without renewal (default 30 s). */
  leaseMs?: number
}
const LEASE_MS = 30_000
const HASH = /^0x[0-9a-f]{64}$/i
function sameAttempt(a: PendingWithdrawal, b: PendingWithdrawal): boolean {
  if (a.attemptId || b.attemptId) return !!a.attemptId && a.attemptId === b.attemptId
  return a.streamId === b.streamId && a.hash === b.hash && a.afterBlock === b.afterBlock
}
export class WithdrawalCoordinator {
  private state: WithdrawalState = {
    phase: 'idle',
    streamId: null,
    hash: null,
    result: null,
    error: null,
    checking: false,
  }
  private listeners = new Set<() => void>()
  private busy = false
  private marker: PendingWithdrawal | null = null
  constructor(private deps: WithdrawalDependencies) {
    try {
      const pending = deps.store.read()
      if (pending) {
        this.marker = pending
        this.state = {
          ...this.state,
          phase: 'unknown',
          streamId: BigInt(pending.streamId),
          hash: pending.hash,
        }
      }
    } catch (error) {
      this.state = { ...this.state, phase: 'failed', error }
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private update(patch: Partial<WithdrawalState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  private get leaseMs() {
    return this.deps.leaseMs ?? LEASE_MS
  }
  private now() {
    return this.deps.now?.() ?? Date.now()
  }
  private leaseActive(pending: PendingWithdrawal) {
    return !!pending.leaseUntil && Number(pending.leaseUntil) > this.now()
  }
  private ownsMarker() {
    const stored = this.deps.store.read()
    return !!this.marker && !!stored && sameAttempt(this.marker, stored)
  }
  private save(patch: Partial<PendingWithdrawal>) {
    if (!this.marker || !this.ownsMarker()) throw new WithdrawalError('PENDING_CHANGED')
    this.marker = { ...this.marker, ...patch }
    this.deps.store.write(this.marker)
  }
  private clearOwnMarker() {
    if (!this.ownsMarker()) return false
    this.deps.store.write(null)
    this.marker = null
    return true
  }
  /** Re-reads this attempt so a hash or lease written by another tab is seen. */
  private refreshMarker() {
    const stored = this.deps.store.read()
    if (this.marker && stored && sameAttempt(this.marker, stored)) this.marker = stored
    return stored
  }
  private renewLease() {
    try {
      if (this.marker && !this.marker.hash && this.ownsMarker())
        this.save({ leaseUntil: String(this.now() + this.leaseMs) })
    } catch {
      /* The lease lapses on its own; the signature result is still handled. */
    }
  }
  private releaseLease() {
    try {
      if (this.marker && !this.marker.hash && this.ownsMarker()) this.save({ leaseUntil: null })
    } catch {
      /* The lease simply expires. */
    }
  }
  /**
   * Records a hash the wallet returned. A real transaction must never lose its
   * record: if this tab's marker vanished it is written back; if another attempt
   * replaced it, the hash is still shown and recovery is required.
   */
  private keepHash(hash: Hex) {
    const stored = this.deps.store.read()
    if (this.marker && stored && sameAttempt(this.marker, stored)) {
      this.save({ hash, leaseUntil: null })
      return
    }
    if (this.marker && !stored) {
      this.marker = { ...this.marker, hash, leaseUntil: null }
      this.deps.store.write(this.marker)
      return
    }
    this.update({ hash })
    throw new WithdrawalError('PENDING_CHANGED')
  }
  select(id: bigint) {
    if (this.busy || ['pending', 'unknown'].includes(this.state.phase) || id < BigInt(1)) return
    this.update({ phase: 'confirming', streamId: id, hash: null, result: null, error: null })
  }
  choose() {
    if (!this.busy && !['pending', 'unknown'].includes(this.state.phase))
      this.update({ phase: 'idle', streamId: null, hash: null, result: null, error: null })
  }
  async submit() {
    if (
      this.busy ||
      this.state.phase !== 'confirming' ||
      this.state.streamId === null ||
      !this.deps.isCurrent()
    )
      return
    this.busy = true
    const id = this.state.streamId
    let sending = false
    try {
      this.update({ phase: 'confirming', checking: true, error: null })
      const request = await this.deps.writer.prepare(this.deps.worker, id, this.deps.signal)
      const afterBlock = (await this.deps.writer.submissionBlock()).toString()
      const nonce = await this.deps.submissionNonce?.()
      if (!this.deps.isCurrent()) return
      const existing = this.deps.store.read()
      if (existing) {
        this.marker = existing
        this.update({ phase: 'unknown', hash: existing.hash, streamId: BigInt(existing.streamId) })
        return
      }
      const marker: PendingWithdrawal = {
        streamId: id.toString(),
        hash: null,
        afterBlock,
        ...(nonce === undefined ? {} : { nonce: nonce.toString() }),
        attemptId: crypto.randomUUID(),
        leaseUntil: String(this.now() + this.leaseMs),
      }
      // Saved before the signature so a lost response still blocks another withdrawal.
      this.deps.store.write(marker)
      this.marker = marker
      sending = true
      this.update({ phase: 'signing', checking: false })
      // The lease tells other tabs this signature is still open; the pinned
      // nonce means two signatures of one attempt cannot both be mined.
      const renew = setInterval(() => this.renewLease(), this.leaseMs / 3)
      let hash: Hex
      try {
        ;({ hash } = await this.deps.send(nonce === undefined ? request : { ...request, nonce }))
      } finally {
        clearInterval(renew)
      }
      if (!HASH.test(hash)) throw new WithdrawalError('INVALID_HASH')
      this.update({ phase: 'pending', hash })
      this.keepHash(hash)
      await this.wait(id, hash)
    } catch (error) {
      const beforeSubmission =
        error instanceof WithdrawalError &&
        ['WALLET_CHANGED', 'WALLET_NOT_READY'].includes(error.code)
      if (sending && !isRejected(error) && !beforeSubmission) {
        this.releaseLease()
        this.update({ phase: 'unknown', error, checking: false })
      } else {
        try {
          if (sending) this.clearOwnMarker()
          this.update({ phase: 'failed', error, checking: false })
        } catch (cleanupError) {
          this.update({ phase: 'unknown', error: cleanupError, checking: false })
        }
      }
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }
  private async wait(id: bigint, hash: Hex) {
    try {
      const afterBlock = this.marker?.afterBlock
      const result = await this.deps.writer.settle(
        this.deps.worker,
        id,
        hash,
        afterBlock ? BigInt(afterBlock) : undefined,
      )
      this.clearOwnMarker()
      if (!this.deps.isCurrent()) return
      this.update({ phase: 'success', result, hash: result.hash, error: null })
      try {
        this.deps.onSuccess()
      } catch {
        /* Settlement remains confirmed if refresh fails. */
      }
    } catch (error) {
      const final =
        error instanceof WithdrawalError && ['REVERTED', 'REPLACED'].includes(error.code)
      try {
        if (final) this.clearOwnMarker()
        if (this.deps.isCurrent()) this.update({ phase: final ? 'failed' : 'unknown', error })
      } catch (cleanupError) {
        if (this.deps.isCurrent()) this.update({ phase: 'unknown', error: cleanupError })
      }
    }
  }
  async resume(hash?: Hex) {
    if (
      this.busy ||
      !this.deps.isCurrent() ||
      !['pending', 'unknown'].includes(this.state.phase) ||
      this.state.streamId === null
    )
      return
    let stored: PendingWithdrawal | null
    try {
      stored = this.refreshMarker()
    } catch (error) {
      this.update({ error })
      return
    }
    const target = hash ?? this.marker?.hash ?? this.state.hash
    if (!target || !HASH.test(target)) {
      this.update({ error: new WithdrawalError('INVALID_HASH') })
      return
    }
    this.busy = true
    try {
      // A candidate hash must not overwrite the known submission or its block anchor.
      if (!stored) throw new WithdrawalError('STORAGE_UNAVAILABLE')
      this.update({ phase: 'pending', hash: target, checking: true, error: null })
      await this.wait(this.state.streamId!, target)
    } catch (error) {
      this.update({ phase: 'unknown', error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }
  /**
   * Clears a never-signed attempt. Requires all of: no hash recorded, no live
   * signature lease from any tab, the nonce check showing nothing used the
   * pinned nonce, and the record unchanged after that RPC round trip.
   */
  async abandon() {
    if (
      this.busy ||
      !this.deps.isCurrent() ||
      this.state.phase !== 'unknown' ||
      this.state.hash !== null ||
      !this.marker
    )
      return
    this.busy = true
    this.update({ checking: true, error: null })
    try {
      const stored = this.refreshMarker()
      if (!stored || !sameAttempt(this.marker, stored)) throw new WithdrawalError('PENDING_CHANGED')
      if (stored.hash) {
        // Another tab recorded the hash meanwhile: follow it instead of abandoning.
        this.update({ hash: stored.hash, streamId: BigInt(stored.streamId) })
        return
      }
      if (this.leaseActive(stored)) throw new WithdrawalError('SIGNATURE_PENDING')
      if (
        !stored.nonce ||
        !stored.afterBlock ||
        !this.deps.verifyAbandoned ||
        !(await this.deps.verifyAbandoned(stored)) ||
        !this.deps.isCurrent()
      )
        throw new WithdrawalError('RECOVERY_UNVERIFIED')
      const after = this.refreshMarker()
      if (!after || !sameAttempt(stored, after) || after.hash || this.leaseActive(after))
        throw new WithdrawalError('PENDING_CHANGED')
      if (!this.clearOwnMarker()) throw new WithdrawalError('PENDING_CHANGED')
      this.update({ phase: 'idle', streamId: null, hash: null, error: null })
    } catch (error) {
      this.update({ phase: 'unknown', error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }
}
export function isRejected(error: unknown): boolean {
  let value = error as { code?: unknown; name?: string; cause?: unknown } | null
  for (let n = 0; value && n < 10; n++, value = value.cause as typeof value) {
    if (
      value.code === 4001 ||
      value.code === 'ACTION_REJECTED' ||
      value.name === 'UserRejectedRequestError'
    )
      return true
  }
  return false
}
