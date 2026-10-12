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
}
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
  private ownsMarker() {
    const stored = this.deps.store.read()
    return !!this.marker && !!stored && sameAttempt(this.marker, stored)
  }
  private clearOwnMarker() {
    if (!this.ownsMarker()) return false
    this.deps.store.write(null)
    this.marker = null
    return true
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
        this.update({ phase: 'unknown', hash: existing.hash, streamId: BigInt(existing.streamId) })
        return
      }
      const marker: PendingWithdrawal = {
        streamId: id.toString(),
        hash: null,
        afterBlock,
        ...(nonce === undefined ? {} : { nonce: nonce.toString() }),
        attemptId: crypto.randomUUID(),
      }
      this.deps.store.write(marker)
      this.marker = marker
      sending = true
      this.update({ phase: 'signing', checking: false })
      const { hash } = await this.deps.send(request)
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new WithdrawalError('INVALID_HASH')
      this.update({ phase: 'pending', hash })
      if (!this.ownsMarker()) throw new WithdrawalError('PENDING_CHANGED')
      const hashed = { ...marker, hash }
      this.deps.store.write(hashed)
      this.marker = hashed
      await this.wait(id, hash)
    } catch (error) {
      const beforeSubmission =
        error instanceof WithdrawalError &&
        ['WALLET_CHANGED', 'WALLET_NOT_READY'].includes(error.code)
      if (sending && !isRejected(error) && !beforeSubmission)
        this.update({ phase: 'unknown', error, checking: false })
      else {
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
    const target = hash ?? this.state.hash
    if (!target || !/^0x[0-9a-f]{64}$/i.test(target)) {
      this.update({ error: new WithdrawalError('INVALID_HASH') })
      return
    }
    this.busy = true
    try {
      // A candidate hash must not overwrite the known submission or its block anchor.
      if (!this.deps.store.read()) throw new WithdrawalError('STORAGE_UNAVAILABLE')
      this.update({ phase: 'pending', hash: target, checking: true, error: null })
      await this.wait(this.state.streamId!, target)
    } catch (error) {
      this.update({ phase: 'unknown', error })
    } finally {
      this.busy = false
      this.update({ checking: false })
    }
  }
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
      if (
        !this.ownsMarker() ||
        !this.marker.nonce ||
        !this.marker.afterBlock ||
        !this.deps.verifyAbandoned ||
        !(await this.deps.verifyAbandoned(this.marker)) ||
        !this.deps.isCurrent()
      )
        throw new WithdrawalError('RECOVERY_UNVERIFIED')
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
