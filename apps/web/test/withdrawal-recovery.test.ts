import { describe, expect, it, vi } from 'vitest'
import { WithdrawalCoordinator, type PendingWithdrawal } from '@/lib/chain/withdrawal-coordinator'
import type { createPayrollWriter, WithdrawalResult } from '@/lib/chain/payroll-writer'

const worker = '0x2222222222222222222222222222222222222222' as const
const h1 = `0x${'a'.repeat(64)}` as const
const h2 = `0x${'b'.repeat(64)}` as const
const result: WithdrawalResult = {
  hash: h1,
  streamId: BigInt(1),
  toWorker: BigInt(1),
  toRecipients: BigInt(0),
  paid: [],
}
function writer(settle: () => Promise<WithdrawalResult>) {
  return {
    prepare: async () => ({
      from: worker,
      to: worker,
      data: '0x' as const,
      chainId: 10143,
      value: BigInt(0),
    }),
    submissionBlock: async () => BigInt(1),
    submissionNonce: async () => BigInt(7),
    canAbandon: async () => true,
    settle,
  } satisfies ReturnType<typeof createPayrollWriter>
}

describe('review withdrawal regressions', () => {
  it('releases an approval interrupted by reload only after nonce and chain checks', async () => {
    let pending: PendingWithdrawal | null = null
    const store = {
      read: () => pending,
      write: (value: PendingWithdrawal | null) => {
        pending = value
      },
    }
    const deps = {
      worker,
      writer: writer(async () => result),
      store,
      isCurrent: () => true,
      onSuccess: () => {},
      send: async (): Promise<{ hash: typeof h1 }> => new Promise(() => {}),
      submissionNonce: async () => BigInt(7),
      verifyAbandoned: vi.fn(async () => true),
    }
    const interrupted = new WithdrawalCoordinator(deps)
    interrupted.select(BigInt(1))
    void interrupted.submit()
    await vi.waitFor(() => expect(pending?.hash).toBeNull())
    const recovered = new WithdrawalCoordinator(deps)
    expect(recovered.getSnapshot().phase).toBe('unknown')
    await recovered.abandon()
    expect(deps.verifyAbandoned).toHaveBeenCalledOnce()
    expect(store.read()).toBeNull()
    expect(recovered.getSnapshot().phase).toBe('idle')
  })

  it('keeps an uncertain submission locked when chain verification cannot prove it unsent', async () => {
    let pending: PendingWithdrawal | null = {
      streamId: '1',
      hash: null,
      afterBlock: '1',
      nonce: '7',
      attemptId: 'attempt-1',
    }
    const store = {
      read: () => pending,
      write: (value: PendingWithdrawal | null) => {
        pending = value
      },
    }
    const recovered = new WithdrawalCoordinator({
      worker,
      writer: writer(async () => result),
      store,
      isCurrent: () => true,
      onSuccess: () => {},
      send: async () => ({ hash: h1 }),
      verifyAbandoned: vi.fn(async () => false),
    })
    await recovered.abandon()
    expect(store.read()).not.toBeNull()
    expect(recovered.getSnapshot().phase).toBe('unknown')
  })

  it('keeps a newer submission record when a second observer finishes an old receipt', async () => {
    let pending: PendingWithdrawal | null = { streamId: '1', hash: h1, afterBlock: '1' }
    const store = {
      read: () => pending,
      write: (value: PendingWithdrawal | null) => {
        pending = value
      },
    }
    let finishOld!: (value: WithdrawalResult) => void
    let finishNew!: (value: WithdrawalResult) => void
    let calls = 0
    const common = {
      worker,
      store,
      isCurrent: () => true,
      onSuccess: () => {},
      send: async () => ({ hash: h2 }),
    }
    const tabA = new WithdrawalCoordinator({
      ...common,
      writer: writer(async () => {
        if (++calls === 1) return result
        return new Promise((resolve) => {
          finishNew = resolve
        })
      }),
    })
    const tabB = new WithdrawalCoordinator({
      ...common,
      writer: writer(
        () =>
          new Promise((resolve) => {
            finishOld = resolve
          }),
      ),
    })
    const oldB = tabB.resume()
    await tabA.resume()
    tabA.select(BigInt(1))
    const newA = tabA.submit()
    await vi.waitFor(() => expect(store.read()?.hash).toBe(h2))
    finishOld(result)
    await oldB
    const recordAfterOldReceipt = store.read()
    finishNew({ ...result, hash: h2 })
    await newA
    expect(recordAfterOldReceipt?.hash).toBe(h2)
  })

  it('does not stay signing or reject its promise when cancellation cleanup cannot access storage', async () => {
    let pending: PendingWithdrawal | null = null
    const coordinator = new WithdrawalCoordinator({
      worker,
      writer: writer(async () => result),
      isCurrent: () => true,
      onSuccess: () => {},
      send: async () => {
        throw { code: 4001 }
      },
      store: {
        read: () => pending,
        write: (value) => {
          if (value === null) throw new Error('Storage unavailable')
          pending = value
        },
      },
    })
    coordinator.select(BigInt(1))
    let escaped: unknown
    try {
      await coordinator.submit()
    } catch (error) {
      escaped = error
    }
    expect.soft(escaped).toBeUndefined()
    expect.soft(coordinator.getSnapshot().phase).not.toBe('signing')
  })
})
