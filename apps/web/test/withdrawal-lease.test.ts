// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Hex } from 'viem'
import type { createPayrollWriter, WithdrawalResult } from '@/lib/chain/payroll-writer'
import {
  WithdrawalCoordinator,
  createMemoryLock,
  type PendingWithdrawal,
  type WithdrawalDependencies,
} from '@/lib/chain/withdrawal-coordinator'
import { pendingWithdrawalStore } from '@/lib/chain/withdraw-storage'

const b = BigInt
const worker = '0x2222222222222222222222222222222222222222' as const
const hash = `0x${'a'.repeat(64)}` as Hex
const result: WithdrawalResult = {
  hash,
  streamId: b(1),
  toWorker: b(900),
  toRecipients: b(100),
  paid: [{ recipient: '0x3333333333333333333333333333333333333333', amount: b(100) }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}
function memoryStore() {
  let pending: PendingWithdrawal | null = null
  return {
    read: () => pending,
    write: (value: PendingWithdrawal | null) => {
      pending = value
    },
    raw: () => pending,
    set: (value: PendingWithdrawal | null) => {
      pending = value
    },
  }
}
function writer() {
  return {
    prepare: vi.fn(async () => ({
      from: worker,
      to: worker,
      data: '0x' as const,
      chainId: 10143,
      value: b(0),
    })),
    submissionBlock: vi.fn(async () => b(20)),
    submissionNonce: vi.fn(async () => b(7)),
    canAbandon: vi.fn(async () => true),
    settle: vi.fn(async () => result),
  } satisfies ReturnType<typeof createPayrollWriter>
}
/** Two coordinators over one store, like two tabs of the same wallet. */
function tabs(overrides: Partial<WithdrawalDependencies> = {}) {
  const store = memoryStore()
  const signature = deferred<{ hash: Hex }>()
  const send = vi
    .fn()
    .mockImplementationOnce(() => signature.promise)
    .mockResolvedValue({ hash })
  const w = writer()
  const verifyAbandoned = vi.fn(async () => true)
  const deps: WithdrawalDependencies = {
    worker,
    writer: w,
    store,
    send,
    isCurrent: () => true,
    onSuccess: vi.fn(),
    submissionNonce: () => w.submissionNonce(),
    verifyAbandoned,
    ...overrides,
  }
  const open = () => new WithdrawalCoordinator(deps)
  return { store, signature, send, writer: w, verifyAbandoned, deps, first: open(), open }
}
async function startSigning(first: WithdrawalCoordinator, send: ReturnType<typeof vi.fn>) {
  first.select(b(1))
  const run = first.submit()
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  return run
}
afterEach(() => vi.useRealTimers())

describe('withdrawal signature lease across tabs', () => {
  it('pins the stored nonce on the signature request', async () => {
    const { first, send, signature } = tabs()
    const run = startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ nonce: b(7) }))
    signature.resolve({ hash })
    await run
  })

  it('refuses abandon and a second withdrawal while the first signature is open', async () => {
    const { first, send, signature, verifyAbandoned, open } = tabs()
    void startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const second = open()
    expect(second.getSnapshot().phase).toBe('unknown')
    await second.abandon()
    expect(second.getSnapshot()).toMatchObject({
      phase: 'unknown',
      error: expect.objectContaining({ code: 'SIGNATURE_PENDING' }),
    })
    expect(verifyAbandoned).not.toHaveBeenCalled()
    second.select(b(1))
    await second.submit()
    signature.resolve({ hash })
    await vi.waitFor(() => expect(first.getSnapshot().phase).toBe('success'))
    expect(send).toHaveBeenCalledOnce()
  })

  it('renews the lease while the wallet prompt stays open', async () => {
    vi.useFakeTimers()
    let clock = 1_000
    const { first, send, store, signature } = tabs({ now: () => clock, leaseMs: 30_000 })
    first.select(b(1))
    const run = first.submit()
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const initial = Number(store.raw()!.leaseUntil)
    clock += 25_000
    await vi.advanceTimersByTimeAsync(10_000)
    expect(Number(store.raw()!.leaseUntil)).toBeGreaterThan(initial)
    signature.resolve({ hash })
    await run
    expect(store.raw()).toBeNull()
  })

  it('abandons only after the lease lapsed and the nonce check passed', async () => {
    let clock = 1_000
    const { first, send, verifyAbandoned, store, open } = tabs({ now: () => clock })
    void startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    clock += 60_000
    const second = open()
    verifyAbandoned.mockResolvedValueOnce(false)
    await second.abandon()
    expect(second.getSnapshot().error).toMatchObject({ code: 'RECOVERY_UNVERIFIED' })
    expect(store.raw()).not.toBeNull()
    await second.abandon()
    expect(verifyAbandoned).toHaveBeenLastCalledWith(
      expect.objectContaining({ nonce: '7', afterBlock: '20' }),
    )
    expect(second.getSnapshot().phase).toBe('idle')
    expect(store.raw()).toBeNull()
  })

  it('re-checks the marker after the nonce RPC and keeps it if a hash appeared', async () => {
    let clock = 1_000
    const { first, send, store, verifyAbandoned, open } = tabs({ now: () => clock })
    void startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    clock += 60_000
    const second = open()
    verifyAbandoned.mockImplementationOnce(async () => {
      // The first tab records its hash while the RPC call is in flight.
      store.set({ ...store.raw()!, hash, leaseUntil: null })
      return true
    })
    await second.abandon()
    expect(second.getSnapshot()).toMatchObject({
      phase: 'unknown',
      error: expect.objectContaining({ code: 'PENDING_CHANGED' }),
    })
    expect(store.raw()?.hash).toBe(hash)
  })

  it('follows a hash recorded by another tab instead of abandoning', async () => {
    const { send, store, verifyAbandoned, open } = tabs()
    const record = { streamId: '1', hash: null, afterBlock: '20', nonce: '7', attemptId: 'a' }
    store.set({ ...record, leaseUntil: null })
    const later = open()
    expect(later.getSnapshot()).toMatchObject({ phase: 'unknown', hash: null })
    // The signing tab records its hash after this tab loaded.
    store.set({ ...record, hash, leaseUntil: null })
    await later.abandon()
    expect(verifyAbandoned).not.toHaveBeenCalled()
    expect(later.getSnapshot()).toMatchObject({ phase: 'unknown', hash })
    await later.resume()
    expect(later.getSnapshot().phase).toBe('success')
    expect(send).not.toHaveBeenCalled()
  })

  it('writes a returned hash back if the record vanished while signing', async () => {
    const { first, send, signature, store, writer: w } = tabs()
    const run = startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    let storedAtSettle: PendingWithdrawal | null = null
    w.settle.mockImplementationOnce(async () => {
      storedAtSettle = store.raw()
      return result
    })
    store.set(null)
    signature.resolve({ hash })
    await run
    expect(storedAtSettle).toMatchObject({ hash, leaseUntil: null })
    expect(first.getSnapshot().phase).toBe('success')
  })

  it('keeps a returned hash visible when another attempt replaced the record', async () => {
    const { first, send, signature, store, writer: w } = tabs()
    const run = startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    store.set({ ...store.raw()!, attemptId: 'someone-else' })
    signature.resolve({ hash })
    await run
    expect(first.getSnapshot()).toMatchObject({
      phase: 'unknown',
      hash,
      error: expect.objectContaining({ code: 'PENDING_CHANGED' }),
    })
    expect(w.settle).not.toHaveBeenCalled()
  })

  it('releases the lease when the wallet call ends with an unknown outcome', async () => {
    const { first, store } = tabs({ send: vi.fn(async () => Promise.reject(new Error('lost'))) })
    first.select(b(1))
    await first.submit()
    expect(first.getSnapshot().phase).toBe('unknown')
    expect(store.raw()).toMatchObject({ hash: null, leaseUntil: null })
  })
})

describe('withdrawal record storage', () => {
  it('round-trips the lease and rejects a malformed one', () => {
    const store = pendingWithdrawalStore(worker)
    store.write({ streamId: '1', hash: null, attemptId: 'a', leaseUntil: '1700000000000' })
    expect(store.read()).toMatchObject({ leaseUntil: '1700000000000' })
    window.localStorage.setItem(
      Object.keys(window.localStorage).find((key) => key.startsWith('trickle:withdraw:'))!,
      JSON.stringify({ streamId: '1', hash: null, leaseUntil: 'soon' }),
    )
    expect(() => store.read()).toThrow()
    store.write(null)
  })
})

describe('withdrawal attempt ownership across tabs', () => {
  it('lets only one tab enter the signing step even when storage reads are stale', async () => {
    // Each tab sees the other's write only later, like separate browser processes.
    const shared = { value: null as PendingWithdrawal | null }
    const store = {
      read: () => shared.value,
      write: (value: PendingWithdrawal | null) => {
        setTimeout(() => {
          shared.value = value
        }, 0)
      },
    }
    const lock = createMemoryLock()
    const signature = deferred<{ hash: Hex }>()
    const send = vi.fn(() => signature.promise)
    const deps = {
      worker,
      writer: writer(),
      store,
      send,
      isCurrent: () => true,
      onSuccess: vi.fn(),
      submissionNonce: async () => b(7),
      lock,
    }
    const one = new WithdrawalCoordinator(deps)
    const two = new WithdrawalCoordinator(deps)
    one.select(b(1))
    two.select(b(1))
    const runs = Promise.all([one.submit(), two.submit()])
    await vi.waitFor(() => expect(two.getSnapshot().phase).toBe('failed'))
    expect(send).toHaveBeenCalledOnce()
    expect(two.getSnapshot().error).toMatchObject({ code: 'SIGNATURE_PENDING' })
    signature.resolve({ hash })
    await runs
  })

  it('refuses abandon while another tab holds the signing lock', async () => {
    const lock = createMemoryLock()
    const { first, send, store, verifyAbandoned, open } = tabs({ lock, now: () => 1e15 })
    void startSigning(first, send)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    // Even with an expired lease, the lock proves the prompt is still open.
    store.set({ ...store.raw()!, leaseUntil: '1' })
    const second = open()
    await second.abandon()
    expect(second.getSnapshot().error).toMatchObject({ code: 'SIGNATURE_PENDING' })
    expect(verifyAbandoned).not.toHaveBeenCalled()
  })

  it('keeps a signed hash across reload when another attempt replaced the record', async () => {
    window.localStorage.clear()
    const store = pendingWithdrawalStore(worker)
    const signature = deferred<{ hash: Hex }>()
    const send = vi.fn(() => signature.promise)
    const w = writer()
    // Settlement cannot be confirmed yet, so the hash must survive a reload.
    w.settle.mockRejectedValueOnce(new Error('rpc timeout'))
    const deps: WithdrawalDependencies = {
      worker,
      writer: w,
      store,
      send,
      isCurrent: () => true,
      onSuccess: vi.fn(),
      submissionNonce: async () => b(7),
    }
    const first = new WithdrawalCoordinator(deps)
    first.select(b(1))
    const run = first.submit()
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    store.write({ streamId: '1', hash: null, attemptId: 'someone-else', afterBlock: '20' })
    signature.resolve({ hash })
    await run
    expect(first.getSnapshot()).toMatchObject({ phase: 'unknown', hash })
    const reloaded = new WithdrawalCoordinator(deps)
    expect(reloaded.getSnapshot()).toMatchObject({ phase: 'unknown', hash })
    await reloaded.resume()
    expect(reloaded.getSnapshot().phase).toBe('success')
    expect(send).toHaveBeenCalledOnce()
    window.localStorage.clear()
  })

  it('checks a manually entered hash against the stored nonce', async () => {
    const { store, writer: w, open } = tabs()
    store.set({ streamId: '1', hash: null, afterBlock: '20', nonce: '7', attemptId: 'a' })
    const recovered = open()
    const manual = `0x${'b'.repeat(64)}` as Hex
    await recovered.resume(manual)
    expect(w.settle).toHaveBeenCalledWith(worker, b(1), manual, b(20), b(7))
  })
})

describe('withdrawal recovery records', () => {
  it('does not bring back a stashed attempt after it settled', async () => {
    window.localStorage.clear()
    const store = pendingWithdrawalStore(worker)
    const signature = deferred<{ hash: Hex }>()
    const send = vi.fn(() => signature.promise)
    const deps: WithdrawalDependencies = {
      worker,
      writer: writer(),
      store,
      send,
      isCurrent: () => true,
      onSuccess: vi.fn(),
      submissionNonce: async () => b(7),
    }
    const first = new WithdrawalCoordinator(deps)
    first.select(b(1))
    const run = first.submit()
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    // Another signed attempt holds the slot, so this one is stashed.
    const otherHash = `0x${'c'.repeat(64)}` as Hex
    store.write({
      streamId: '1',
      hash: otherHash,
      attemptId: 'other',
      afterBlock: '20',
      nonce: '6',
    })
    signature.resolve({ hash })
    await run
    expect(first.getSnapshot()).toMatchObject({ phase: 'unknown', hash })
    await first.resume()
    expect(first.getSnapshot().phase).toBe('success')
    // The other attempt is still pending and must come back; this one must not.
    const reloaded = new WithdrawalCoordinator(deps)
    expect(reloaded.getSnapshot()).toMatchObject({ phase: 'unknown', hash: otherHash })
    await reloaded.resume()
    expect(reloaded.getSnapshot().phase).toBe('success')
    const again = new WithdrawalCoordinator(deps)
    expect(again.getSnapshot()).toMatchObject({ phase: 'idle', hash: null })
    window.localStorage.clear()
  })

  it('removes a stashed record by attempt id', () => {
    window.localStorage.clear()
    const store = pendingWithdrawalStore(worker)
    store.stash!({ streamId: '1', hash, attemptId: 'a' })
    store.stash!({ streamId: '1', hash: null, attemptId: 'b' })
    store.removeStashed!('a')
    expect(store.takeStashed!()).toMatchObject({ attemptId: 'b' })
    expect(store.takeStashed!()).toBeNull()
    window.localStorage.clear()
  })

  it.each([
    ['a stored hash', { streamId: '1', hash, afterBlock: '20', attemptId: 'old' }, undefined],
    [
      'a manual hash',
      { streamId: '1', hash: null, afterBlock: '20', attemptId: 'old' },
      `0x${'b'.repeat(64)}` as Hex,
    ],
  ])('refuses to recover %s from a record without a nonce', async (_, record, manual) => {
    const { store, writer: w, open, send } = tabs()
    store.set(record as PendingWithdrawal)
    const recovered = open()
    await recovered.resume(manual)
    expect(recovered.getSnapshot()).toMatchObject({
      phase: 'unknown',
      error: expect.objectContaining({ code: 'RECOVERY_UNVERIFIED' }),
    })
    expect(w.settle).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('refuses to start a withdrawal whose nonce cannot be pinned', async () => {
    const { first, send, store } = tabs({ submissionNonce: undefined })
    first.select(b(1))
    await first.submit()
    expect(first.getSnapshot()).toMatchObject({
      phase: 'failed',
      error: expect.objectContaining({ code: 'RECOVERY_UNVERIFIED' }),
    })
    expect(send).not.toHaveBeenCalled()
    expect(store.raw()).toBeNull()
  })
})
