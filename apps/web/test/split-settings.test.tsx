// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hex } from 'viem'
import { useSplitSettings } from '@/hooks/use-split-settings'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  account: {} as Account,
  session: {} as SessionContextValue,
  prepare: vi.fn(),
  settle: vi.fn(),
}))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/chain/split-writer', () => ({
  createSplitPort: vi.fn(),
  createSplitWriter: () => ({ prepare: deps.prepare, settle: deps.settle }),
}))

const b = BigInt
const worker = '0x2222222222222222222222222222222222222222'
const hash = `0x${'a'.repeat(64)}` as Hex
const splits = [{ recipient: '0x3333333333333333333333333333333333333333' as const, bps: 2000 }]
const request = { from: worker, to: worker, data: '0x' as Hex, chainId: 10143, value: b(0) }

beforeEach(() => {
  vi.clearAllMocks()
  deps.account = {
    configured: true,
    ready: true,
    authenticated: true,
    user: { id: 'privy-1', email: null },
    walletAddress: worker,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => 'privy'),
    sendTransaction: vi.fn(async () => ({ hash })),
  }
  deps.session = {
    status: 'ready',
    user: {
      id: 'user-1',
      address: worker,
      displayName: null,
      companyId: null,
      createdAt: '2026-10-12T00:00:00Z',
      roles: { employer: false, worker: true, recipient: false },
    },
    expiresAt: '2099-01-01T00:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => 'token'),
    refreshMe: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
  }
  deps.prepare.mockResolvedValue(request)
  deps.settle.mockImplementation(async (_w, list) => ({ hash, splits: list }))
})
afterEach(cleanup)

function hook(onSuccess = vi.fn(), onSigning = vi.fn()) {
  return {
    ...renderHook(() => useSplitSettings(worker, onSuccess, onSigning)),
    onSuccess,
    onSigning,
  }
}

describe('setSplits flow', () => {
  it('hands off the sheet, signs once, verifies the receipt and refreshes', async () => {
    const order: string[] = []
    const onSigning = vi.fn(() => void order.push('handoff'))
    vi.mocked(deps.account.sendTransaction).mockImplementation(async () => {
      order.push('sign')
      return { hash }
    })
    const { result, onSuccess } = hook(vi.fn(), onSigning)
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(order).toEqual(['handoff', 'sign'])
    expect(deps.prepare).toHaveBeenCalledWith(worker, splits)
    expect(deps.settle).toHaveBeenCalledWith(worker, splits, hash)
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('turns the split off with an empty list', async () => {
    const { result } = hook()
    act(() => result.current.save([]))
    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(deps.prepare).toHaveBeenCalledWith(worker, [])
    expect(result.current.state.splits).toEqual([])
  })

  it('sends only once on a double click', async () => {
    const { result } = hook()
    act(() => {
      result.current.save(splits)
      result.current.save(splits)
    })
    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(deps.account.sendTransaction).toHaveBeenCalledOnce()
  })

  it('fails cleanly before signing when preparation fails', async () => {
    deps.prepare.mockRejectedValue(new WithdrawalError('GAS_INSUFFICIENT'))
    const { result } = hook()
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state.phase).toBe('failed'))
    expect(deps.account.sendTransaction).not.toHaveBeenCalled()
  })

  it('treats a rejected signature as failed, not unknown', async () => {
    vi.mocked(deps.account.sendTransaction).mockRejectedValue({ code: 4001 })
    const { result } = hook()
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state.phase).toBe('failed'))
  })

  it('keeps an unclear wallet failure unknown and allows a reset', async () => {
    vi.mocked(deps.account.sendTransaction).mockRejectedValue(new Error('connection lost'))
    const { result } = hook()
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state.phase).toBe('unknown'))
    act(() => result.current.save(splits))
    expect(deps.account.sendTransaction).toHaveBeenCalledOnce()
    act(() => result.current.reset())
    expect(result.current.state.phase).toBe('idle')
  })

  it('rechecks a known hash without signing again', async () => {
    deps.settle.mockRejectedValueOnce(new Error('rpc timeout'))
    const { result, onSuccess } = hook()
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state).toMatchObject({ phase: 'unknown', hash }))
    act(() => result.current.recheck())
    await waitFor(() => expect(result.current.state.phase).toBe('success'))
    expect(deps.account.sendTransaction).toHaveBeenCalledOnce()
    expect(onSuccess).toHaveBeenCalledOnce()
  })

  it('reports a reverted transaction as failed', async () => {
    deps.settle.mockRejectedValue(new WithdrawalError('REVERTED'))
    const { result } = hook()
    act(() => result.current.save(splits))
    await waitFor(() => expect(result.current.state.phase).toBe('failed'))
  })

  it('does not sign when the account changed during preparation', async () => {
    let release!: (value: typeof request) => void
    deps.prepare.mockImplementation(() => new Promise((done) => (release = done)))
    const { result, rerender } = hook()
    act(() => result.current.save(splits))
    deps.account = { ...deps.account, user: { id: 'privy-2', email: null } }
    rerender()
    await act(async () => release(request))
    expect(deps.account.sendTransaction).not.toHaveBeenCalled()
  })
})
