import type { Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import type { PayoutDto } from '@/lib/api/payouts'
import type { PayrollConfig } from '@/lib/chain/config'
import { PayoutCoordinator, type PayoutCoordinatorDeps } from '@/lib/chain/payout-coordinator'
import { payoutStorageKey, pendingPayoutStore } from '@/lib/chain/payout-storage'
import { PayoutError } from '@/lib/chain/payout-writer'

const b = BigInt
const wallet = '0x2222222222222222222222222222222222222222' as const
const other = '0x5555555555555555555555555555555555555555' as const
const destination = '0x4444444444444444444444444444444444444444' as const
const token = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'ab'.repeat(32)}` as Hex
const config: PayrollConfig = {
  chainId: 10143,
  rpcUrl: 'http://test',
  payrollAddress: '0x1111111111111111111111111111111111111111',
  tokenAddress: token,
  deploymentBlock: b(10),
  tokenDecimals: 6,
  isMock: true,
  explorerUrl: 'http://explorer',
}
const payout = (status: PayoutDto['status'] = 'PROCESSING', txHash = hash): PayoutDto => ({
  id: 'payout-1',
  status,
  amountUsd: '5',
  amountIdr: 81250,
  fxRate: 16250,
  fxSource: 'live',
  sourceTxHash: txHash,
  bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '0123' },
  provider: 'mock',
  providerRef: 'ref',
  testMode: true,
  failureReason: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
})

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

function setup(storage = memory(), overrides: Partial<PayoutCoordinatorDeps> = {}) {
  const store = pendingPayoutStore(wallet, config, () => storage)
  const writer = {
    prepare: vi.fn(async () => ({
      from: wallet,
      to: token,
      data: '0xa9059cbb' as Hex,
      chainId: 10143,
      value: b(0),
    })),
    submissionBlock: vi.fn(async () => b(20)),
    submissionNonce: vi.fn(async () => b(7)),
    settle: vi.fn(async () => ({ hash, amount: b(5_000_000), blockNumber: b(30) })),
    canAbandon: vi.fn(async () => true),
  }
  const deps: PayoutCoordinatorDeps = {
    wallet,
    destination,
    writer,
    store,
    config,
    send: vi.fn(async () => ({ hash })),
    isCurrent: () => true,
    checkReady: vi.fn(async () => {}),
    register: vi.fn(async () => payout()),
    onTransferred: vi.fn(),
    newId: () => 'attempt-1',
    ...overrides,
  }
  const make = () => new PayoutCoordinator(deps)
  return { storage, store, writer, deps, make, coordinator: make() }
}
const input = { amountUnits: b(5_000_000), bankAccountId: 'bank-1' }
async function run(coordinator: PayoutCoordinator) {
  coordinator.start()
  await coordinator.submit(input)
}

describe('family payout coordinator', () => {
  it('saves the attempt before signing, then registers the verified hash once', async () => {
    let storedAtSigning: unknown
    const { coordinator, deps, store } = setup(memory(), {})
    vi.mocked(deps.send).mockImplementation(async () => {
      storedAtSigning = store.read()
      return { hash }
    })
    await run(coordinator)
    expect(storedAtSigning).toMatchObject({ txHash: null, nonce: '7', submittedAtBlock: '20' })
    expect(deps.register).toHaveBeenCalledExactlyOnceWith({ txHash: hash, bankAccountId: 'bank-1' })
    expect(deps.onTransferred).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'processing', hash })
    expect(store.read()).toBeNull()
  })

  it('maps the payout status to completed or failed', async () => {
    const done = setup(memory(), { register: vi.fn(async () => payout('COMPLETED')) })
    await run(done.coordinator)
    expect(done.coordinator.getSnapshot().phase).toBe('completed')
    const failed = setup(memory(), { register: vi.fn(async () => payout('FAILED')) })
    await run(failed.coordinator)
    expect(failed.coordinator.getSnapshot().phase).toBe('payout-failed')
  })

  it('checks role and bank account before preparing the transfer', async () => {
    const { coordinator, deps, writer } = setup(memory(), {
      checkReady: vi.fn(async () => {
        throw new ApiError('not-found', 'x', { status: 404, code: 'BANK_ACCOUNT_NOT_FOUND' })
      }),
    })
    await run(coordinator)
    expect(writer.prepare).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().phase).toBe('confirming')
  })

  it('does nothing without a configured destination', async () => {
    const { coordinator, deps } = setup(memory(), { destination: null })
    coordinator.start()
    expect(coordinator.getSnapshot().phase).toBe('idle')
    await coordinator.submit(input)
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('clears the attempt when the signature is rejected', async () => {
    const { coordinator, deps, store } = setup(memory(), {
      send: vi.fn(async () => {
        throw Object.assign(new Error('denied'), { code: 4001 })
      }),
    })
    await run(coordinator)
    expect(coordinator.getSnapshot().phase).toBe('confirming')
    expect(store.read()).toBeNull()
    expect(deps.register).not.toHaveBeenCalled()
  })

  it('blocks a second transfer when the signature result is unknown, also after reload', async () => {
    const { coordinator, deps, store, make } = setup(memory(), {
      send: vi.fn(async () => {
        throw new Error('timeout')
      }),
    })
    await run(coordinator)
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'submission-unknown', hash: null })
    expect(store.read()).toMatchObject({ txHash: null })
    const reloaded = make()
    expect(reloaded.getSnapshot().phase).toBe('submission-unknown')
    reloaded.start()
    await reloaded.submit(input)
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it('abandons an unsent attempt only after the nonce check passes', async () => {
    const { coordinator, writer, store } = setup(memory(), {
      send: vi.fn(async () => {
        throw new Error('timeout')
      }),
    })
    await run(coordinator)
    writer.canAbandon.mockResolvedValueOnce(false)
    await coordinator.abandon()
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'submission-unknown',
      error: expect.objectContaining({ code: 'RECOVERY_UNVERIFIED' }),
    })
    expect(store.read()).not.toBeNull()
    await coordinator.abandon()
    expect(writer.canAbandon).toHaveBeenLastCalledWith(wallet, b(7), b(20))
    expect(coordinator.getSnapshot().phase).toBe('idle')
    expect(store.read()).toBeNull()
  })

  it('resumes a stored hash after reload without sending again', async () => {
    const first = setup(memory(), {
      register: vi.fn(async () => {
        throw new ApiError('network', 'offline')
      }),
    })
    vi.mocked(first.writer.settle).mockRejectedValueOnce(new Error('rpc timeout'))
    await run(first.coordinator)
    expect(first.coordinator.getSnapshot()).toMatchObject({ phase: 'submission-unknown', hash })
    vi.mocked(first.deps.register).mockResolvedValue(payout())
    const reloaded = first.make()
    expect(reloaded.getSnapshot()).toMatchObject({ phase: 'transfer-pending', hash })
    await reloaded.resume()
    expect(reloaded.getSnapshot().phase).toBe('processing')
    expect(first.deps.send).toHaveBeenCalledOnce()
    expect(first.writer.settle).toHaveBeenLastCalledWith(
      wallet,
      destination,
      b(5_000_000),
      hash,
      b(20),
    )
  })

  it.each([
    ['network', new ApiError('network', 'offline')],
    ['401', new ApiError('unauthorized', 'x', { status: 401 })],
    ['TX_PENDING', new ApiError('conflict', 'x', { status: 409, code: 'TX_PENDING' })],
    ['CHAIN_UNAVAILABLE', new ApiError('server', 'x', { status: 502, code: 'CHAIN_UNAVAILABLE' })],
    [
      'PAYOUTS_UNAVAILABLE',
      new ApiError('server', 'x', { status: 503, code: 'PAYOUTS_UNAVAILABLE' }),
    ],
  ])('keeps the hash for re-registration after %s, never transferring again', async (_, error) => {
    const { coordinator, deps, store, make } = setup(memory())
    vi.mocked(deps.register).mockRejectedValueOnce(error)
    await run(coordinator)
    expect(coordinator.getSnapshot()).toMatchObject({ phase: 'registration-pending', hash })
    expect(store.read()).toMatchObject({ txHash: hash })
    // Survives a reload as a stored hash, then registers the same one.
    const reloaded = make()
    await reloaded.resume()
    expect(reloaded.getSnapshot().phase).toBe('processing')
    expect(deps.register).toHaveBeenCalledTimes(2)
    expect(vi.mocked(deps.register).mock.calls.every(([call]) => call.txHash === hash)).toBe(true)
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it('retries registration in place', async () => {
    const { coordinator, deps } = setup(memory())
    vi.mocked(deps.register).mockRejectedValueOnce(new ApiError('network', 'offline'))
    await run(coordinator)
    await coordinator.retryRegistration()
    expect(coordinator.getSnapshot().phase).toBe('processing')
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it('registers the same hash to another account after the bank was deleted', async () => {
    const { coordinator, deps, store } = setup(memory())
    vi.mocked(deps.register).mockRejectedValueOnce(
      new ApiError('not-found', 'x', { status: 404, code: 'BANK_ACCOUNT_NOT_FOUND' }),
    )
    await run(coordinator)
    expect(coordinator.getSnapshot().phase).toBe('registration-pending')
    await coordinator.changeBank('bank-2')
    expect(deps.register).toHaveBeenLastCalledWith({ txHash: hash, bankAccountId: 'bank-2' })
    expect(coordinator.getSnapshot().phase).toBe('processing')
    expect(store.read()).toBeNull()
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it.each(['TX_NOT_A_PAYOUT', 'TX_FAILED', 'PAYOUT_EXISTS'])(
    'stops registration on %s and keeps the hash until dismissed',
    async (code) => {
      const { coordinator, deps, store } = setup(memory())
      vi.mocked(deps.register).mockRejectedValue(
        new ApiError('validation', 'x', { status: 400, code }),
      )
      await run(coordinator)
      expect(coordinator.getSnapshot()).toMatchObject({ phase: 'payout-failed', hash })
      await coordinator.retryRegistration()
      expect(deps.register).toHaveBeenCalledOnce()
      coordinator.dismiss()
      expect(coordinator.getSnapshot().phase).toBe('idle')
      expect(store.read()).toBeNull()
    },
  )

  it('does not accept a payout for another hash', async () => {
    const otherHash = `0x${'cd'.repeat(32)}` as Hex
    const { coordinator, store } = setup(memory(), {
      register: vi.fn(async () => payout('PROCESSING', otherHash)),
    })
    await run(coordinator)
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'registration-pending',
      error: expect.objectContaining({ code: 'PAYOUT_MISMATCH' }),
    })
    expect(store.read()).toMatchObject({ txHash: hash })
  })

  it('treats a reverted transfer as final without registering', async () => {
    const { coordinator, deps, writer, store } = setup(memory())
    writer.settle.mockRejectedValueOnce(new PayoutError('REVERTED'))
    await run(coordinator)
    expect(coordinator.getSnapshot().phase).toBe('transfer-failed')
    expect(deps.register).not.toHaveBeenCalled()
    expect(store.read()).toBeNull()
  })

  it('submits once on a double click', async () => {
    let release!: () => void
    const { coordinator, deps } = setup(memory(), {
      checkReady: vi.fn(() => new Promise<void>((done) => (release = done))),
    })
    coordinator.start()
    const first = coordinator.submit(input)
    const second = coordinator.submit(input)
    release()
    await Promise.all([first, second])
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it('does not register for an account that changed while signing', async () => {
    let current = true
    const { coordinator, deps } = setup(memory(), {
      isCurrent: () => current,
      send: vi.fn(async () => {
        current = false
        return { hash }
      }),
    })
    await run(coordinator)
    expect(deps.register).not.toHaveBeenCalled()
  })

  it('blocks new payouts when the stored record is corrupt', () => {
    const storage = memory()
    storage.setItem(payoutStorageKey(wallet, config), '{not json')
    const { coordinator, deps } = setup(storage)
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'submission-unknown',
      error: expect.objectContaining({ code: 'STORAGE_UNAVAILABLE' }),
    })
    coordinator.start()
    expect(coordinator.getSnapshot().phase).toBe('submission-unknown')
    expect(deps.send).not.toHaveBeenCalled()
  })

  it('clears an unreadable record only after explicit confirmation, then allows a new payout', async () => {
    const storage = memory()
    const key = payoutStorageKey(wallet, config)
    storage.setItem(key, `{"broken": true, "txHash": "${hash}"`)
    const { coordinator, deps } = setup(storage)
    expect(coordinator.getSnapshot()).toMatchObject({ unreadable: true, hash })
    coordinator.discardUnreadable(false)
    expect(storage.getItem(key)).not.toBeNull()
    expect(coordinator.getSnapshot().phase).toBe('submission-unknown')
    coordinator.discardUnreadable(true)
    expect(storage.getItem(key)).toBeNull()
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'idle',
      unreadable: false,
      hash: null,
    })
    await run(coordinator)
    expect(deps.send).toHaveBeenCalledOnce()
  })

  it('never discards a readable recovery record', async () => {
    const { coordinator, store } = setup(memory(), {
      send: vi.fn(async () => {
        throw new Error('timeout')
      }),
    })
    await run(coordinator)
    expect(coordinator.getSnapshot().unreadable).toBe(false)
    coordinator.discardUnreadable(true)
    expect(store.read()).not.toBeNull()
    expect(coordinator.getSnapshot().phase).toBe('submission-unknown')
  })

  it('quarantines a record written for another chain or token', async () => {
    const storage = memory()
    const { store } = setup(storage)
    store.write({
      version: 1,
      attemptId: 'a',
      wallet,
      chainId: 10143,
      token,
      destination,
      amountUnits: '1',
      bankAccountId: 'bank-1',
      txHash: hash,
      nonce: '1',
      submittedAtBlock: '1',
      payoutId: null,
      leaseUntil: null,
    })
    const raw = JSON.parse(storage.getItem(payoutStorageKey(wallet, config))!)
    storage.setItem(payoutStorageKey(wallet, config), JSON.stringify({ ...raw, chainId: 1 }))
    const { coordinator, writer } = setup(storage)
    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'submission-unknown',
      error: expect.objectContaining({ code: 'PENDING_MISMATCH' }),
    })
    await coordinator.resume()
    expect(writer.settle).not.toHaveBeenCalled()
  })

  it('keeps recovery records separate per wallet', async () => {
    const storage = memory()
    const { coordinator } = setup(storage, {
      send: vi.fn(async () => {
        throw new Error('timeout')
      }),
    })
    await run(coordinator)
    expect(pendingPayoutStore(other, config, () => storage).read()).toBeNull()
    expect(storage.getItem(payoutStorageKey(wallet, config))).not.toContain('accountNumber')
  })
})

// Review R1: a second tab must not unlock a new payout while the first tab is
// still waiting for the wallet signature, even though the nonce is unchanged.
describe('cross-tab signature safety', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => (resolve = done))
    return { promise, resolve }
  }
  function tabs(options: { now?: () => number } = {}) {
    const storage = memory()
    const signature = deferred<{ hash: Hex }>()
    const send = vi
      .fn()
      .mockImplementationOnce(() => signature.promise)
      .mockResolvedValue({ hash })
    const first = setup(storage, { send, newId: () => 'attempt-1', ...options })
    // Same storage and send: the second tab only differs by its coordinator.
    const second = () =>
      new PayoutCoordinator({ ...first.deps, newId: () => 'attempt-2', ...options })
    return { storage, signature, send, first, second }
  }

  it('blocks abandon and a new payout while the first signature is outstanding', async () => {
    const { signature, send, first, second } = tabs()
    first.coordinator.start()
    const firstRun = first.coordinator.submit(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const other = second()
    expect(other.getSnapshot().phase).toBe('submission-unknown')
    await other.abandon()
    expect(other.getSnapshot()).toMatchObject({
      phase: 'submission-unknown',
      error: expect.objectContaining({ code: 'SIGNATURE_PENDING' }),
    })
    expect(first.writer.canAbandon).not.toHaveBeenCalled()
    other.start()
    await other.submit(input)
    signature.resolve({ hash })
    await firstRun
    expect(send).toHaveBeenCalledOnce()
    expect(first.coordinator.getSnapshot().phase).toBe('processing')
  })

  it('lets the second tab follow the hash the first tab recorded', async () => {
    const { signature, send, first, second } = tabs()
    vi.mocked(first.deps.register).mockRejectedValueOnce(new ApiError('network', 'offline'))
    first.coordinator.start()
    const firstRun = first.coordinator.submit(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const other = second()
    signature.resolve({ hash })
    await firstRun
    expect(first.coordinator.getSnapshot().phase).toBe('registration-pending')
    // The second tab saw no hash at load time; abandon must switch to it.
    await other.abandon()
    expect(other.getSnapshot()).toMatchObject({ phase: 'transfer-pending', hash })
    await other.resume()
    expect(other.getSnapshot().phase).toBe('processing')
    expect(send).toHaveBeenCalledOnce()
  })

  it('pins the stored nonce on the signature request', async () => {
    const { coordinator, deps } = setup(memory())
    await run(coordinator)
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({ nonce: b(7) }))
  })

  it('allows abandon only after the lease lapsed and the nonce check passed', async () => {
    let clock = 1_000
    const { first, second, send } = tabs({ now: () => clock })
    first.coordinator.start()
    void first.coordinator.submit(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const other = second()
    await other.abandon()
    expect(other.getSnapshot().error).toMatchObject({ code: 'SIGNATURE_PENDING' })
    // The first tab is gone (no renewals) and its lease has expired.
    clock += 60_000
    await other.abandon()
    expect(first.writer.canAbandon).toHaveBeenCalledWith(wallet, b(7), b(20))
    expect(other.getSnapshot().phase).toBe('idle')
  })

  it('renews the lease while the signature is open', async () => {
    vi.useFakeTimers()
    try {
      const { first, send, storage } = tabs()
      first.coordinator.start()
      void first.coordinator.submit(input)
      await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
      const key = payoutStorageKey(wallet, config)
      const initial = Number(JSON.parse(storage.getItem(key)!).leaseUntil)
      await vi.advanceTimersByTimeAsync(25_000)
      expect(Number(JSON.parse(storage.getItem(key)!).leaseUntil)).toBeGreaterThan(initial)
    } finally {
      vi.useRealTimers()
    }
  })

  it('writes a returned hash back if the record was removed while signing', async () => {
    const { signature, send, first, storage } = tabs()
    first.coordinator.start()
    const firstRun = first.coordinator.submit(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    storage.removeItem(payoutStorageKey(wallet, config))
    signature.resolve({ hash })
    await firstRun
    expect(first.coordinator.getSnapshot()).toMatchObject({ phase: 'processing', hash })
    expect(first.deps.register).toHaveBeenCalledWith({ txHash: hash, bankAccountId: 'bank-1' })
  })

  it('surfaces a hash instead of dropping it when another attempt replaced the record', async () => {
    const { signature, send, first, storage } = tabs()
    first.coordinator.start()
    const firstRun = first.coordinator.submit(input)
    await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
    const key = payoutStorageKey(wallet, config)
    const raw = JSON.parse(storage.getItem(key)!)
    storage.setItem(key, JSON.stringify({ ...raw, attemptId: 'someone-else' }))
    signature.resolve({ hash })
    await firstRun
    expect(first.coordinator.getSnapshot()).toMatchObject({
      phase: 'submission-unknown',
      hash,
      error: expect.objectContaining({ code: 'PENDING_CHANGED' }),
    })
    expect(first.deps.register).not.toHaveBeenCalled()
  })
})
