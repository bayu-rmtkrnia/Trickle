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
  /** Keeps a second record (e.g. a signed hash whose slot was taken) across reloads. */
  stash?(p: PendingWithdrawal): void
  /** Removes and returns the oldest stashed record. */
  takeStashed?(): PendingWithdrawal | null
  /** Drops a stashed record once its attempt is settled or definitely failed. */
  removeStashed?(attemptId: string): void
}
/**
 * Runs `run` only if no other tab holds the same lock, atomically. Returns
 * `{ acquired: false }` without running when it is held elsewhere.
 */
export type WithdrawalLock = <T>(
  run: () => Promise<T>,
) => Promise<{ acquired: true; value: T } | { acquired: false }>
/** Same-context lock for tests and environments without Web Locks. */
export function createMemoryLock(): WithdrawalLock {
  let held = false
  return async (run) => {
    if (held) return { acquired: false }
    held = true
    try {
      return { acquired: true, value: await run() }
    } finally {
      held = false
    }
  }
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
  /** Cross-tab lock around the signing step; see `createWebLock`. */
  lock?: WithdrawalLock
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
  private readonly lock: WithdrawalLock
  constructor(private deps: WithdrawalDependencies) {
    this.lock = deps.lock ?? createMemoryLock()
    try {
      const pending = deps.store.read() ?? this.promoteStashed()
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
  /** Moves a stashed record into the main slot when that slot is free. */
  private promoteStashed() {
    const next = this.deps.store.takeStashed?.() ?? null
    if (next) this.deps.store.write(next)
    return next
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
   * record: if this tab's marker vanished it is written back. If another
   * attempt took the slot, the signed record wins the slot when the other has
   * no hash; otherwise it is stashed. Either way it survives a reload.
   */
  private keepHash(hash: Hex) {
    const stored = this.deps.store.read()
    const mine = { ...this.marker!, hash, leaseUntil: null }
    if (this.marker && stored && sameAttempt(this.marker, stored)) {
      this.save({ hash, leaseUntil: null })
      return
    }
    if (this.marker && !stored) {
      this.marker = mine
      this.deps.store.write(this.marker)
      return
    }
    if (stored && !stored.hash && this.deps.store.stash) {
      this.deps.store.stash(stored)
      this.marker = mine
      this.deps.store.write(mine)
      return
    }
    this.deps.store.stash?.(mine)
    this.marker = mine
    this.update({ hash })
    throw new WithdrawalError('PENDING_CHANGED')
  }
  /** A finished attempt must not resurface from the stash after reload. */
  private forget(attemptId: string | undefined) {
    if (attemptId) this.deps.store.removeStashed?.(attemptId)
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
      // Without a pinned nonce the attempt could never be safely recovered.
      if (nonce === undefined) throw new WithdrawalError('RECOVERY_UNVERIFIED')
      if (!this.deps.isCurrent()) return
      // The whole check-then-claim-then-sign step runs under one cross-tab
      // lock, so two tabs can never both see an empty slot and both sign.
      const outcome = await this.lock(async (): Promise<Hex | null> => {
        const existing = this.deps.store.read() ?? this.promoteStashed()
        if (existing) {
          this.marker = existing
          this.update({
            phase: 'unknown',
            hash: existing.hash,
            streamId: BigInt(existing.streamId),
          })
          return null
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
        // The lease covers tabs reloaded mid-prompt; the pinned nonce means two
        // signatures of one attempt cannot both be mined.
        const renew = setInterval(() => this.renewLease(), this.leaseMs / 3)
        let signed: Hex
        try {
          ;({ hash: signed } = await this.deps.send(
            nonce === undefined ? request : { ...request, nonce },
          ))
        } finally {
          clearInterval(renew)
        }
        if (!HASH.test(signed)) throw new WithdrawalError('INVALID_HASH')
        this.update({ phase: 'pending', hash: signed })
        this.keepHash(signed)
        return signed
      })
      if (!outcome.acquired) {
        this.update({
          phase: 'failed',
          error: new WithdrawalError('SIGNATURE_PENDING'),
          checking: false,
        })
        return
      }
      if (outcome.value) await this.wait(id, outcome.value)
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
    const attemptId = this.marker?.attemptId
    try {
      const afterBlock = this.marker?.afterBlock
      const nonce = this.marker?.nonce
      // The stored nonce ties any hash, including a manual one, to this attempt.
      const result = await this.deps.writer.settle(
        this.deps.worker,
        id,
        hash,
        afterBlock ? BigInt(afterBlock) : undefined,
        nonce ? BigInt(nonce) : undefined,
      )
      this.clearOwnMarker()
      this.forget(attemptId)
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
        if (final) {
          this.clearOwnMarker()
          this.forget(attemptId)
        }
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
    // A record without a nonce cannot tie any hash to this attempt.
    if (!this.marker?.nonce) {
      this.update({ phase: 'unknown', error: new WithdrawalError('RECOVERY_UNVERIFIED') })
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
      // Under the signing lock: a tab still showing its wallet prompt holds it.
      const outcome = await this.lock(async () => {
        const stored = this.refreshMarker()
        if (!stored || !sameAttempt(this.marker!, stored))
          throw new WithdrawalError('PENDING_CHANGED')
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
      })
      if (!outcome.acquired) throw new WithdrawalError('SIGNATURE_PENDING')
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
