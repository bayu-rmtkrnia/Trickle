// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hex } from 'viem'
import { useFamilyPayout } from '@/hooks/use-family-payout'
import { ApiError } from '@/lib/api/errors'
import type { PayoutDto } from '@/lib/api/payouts'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  create: vi.fn(),
  session: null as unknown as SessionContextValue,
  account: null as unknown as Account,
  writer: null as unknown,
}))
vi.mock('@/lib/api/payouts', () => ({ createPayout: deps.create }))
vi.mock('@/lib/api/bank-accounts', () => ({
  getBankAccount: vi.fn(async () => ({ id: 'bank-1' })),
}))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/chain/payout-config', () => ({
  payoutAddress: '0x4444444444444444444444444444444444444444',
}))
vi.mock('@/lib/chain/payout-writer', async (actual) => ({
  ...(await actual<typeof import('@/lib/chain/payout-writer')>()),
  createPayoutPort: vi.fn(),
  createPayoutWriter: () => deps.writer,
}))

const b = BigInt
const wallet = '0x2222222222222222222222222222222222222222' as const
const token = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'ab'.repeat(32)}` as Hex
const input = { amountUnits: b(5_000_000), bankAccountId: 'bank-1' }
const dto: PayoutDto = {
  id: 'payout-1',
  status: 'PROCESSING',
  amountUsd: '5',
  amountIdr: 80000,
  fxRate: 16000,
  fxSource: 'live',
  sourceTxHash: hash,
  bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '1234' },
  provider: 'mock',
  providerRef: 'ref',
  testMode: true,
  failureReason: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
}
const me = {
  id: 'user-1',
  address: wallet,
  displayName: null,
  companyId: null,
  createdAt: dto.createdAt,
  roles: { employer: false, worker: false, recipient: true },
}

let cachedToken: string
/** Set once the transfer is sent: the server rejects the cached token from then on. */
let revoked: boolean
let send: ReturnType<typeof vi.fn<Account['sendTransaction']>>

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  cachedToken = 'old-token'
  revoked = false
  send = vi.fn<Account['sendTransaction']>(async () => {
    revoked = true
    return { hash }
  })
  deps.writer = {
    prepare: vi.fn(async () => ({
      from: wallet,
      to: token,
      data: '0x' as Hex,
      chainId: 10143,
      value: b(0),
    })),
    submissionBlock: vi.fn(async () => b(20)),
    submissionNonce: vi.fn(async () => b(7)),
    settle: vi.fn(async () => ({ hash, amount: input.amountUnits, blockNumber: b(30) })),
    canAbandon: vi.fn(async () => false),
  }
  deps.account = {
    configured: true,
    ready: true,
    authenticated: true,
    user: { id: 'privy-1', email: null },
    walletAddress: wallet,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => 'privy'),
    sendTransaction: send,
  }
  deps.session = {
    status: 'ready',
    user: me,
    expiresAt: '2099-01-01T00:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => cachedToken),
    refreshMe: vi.fn(async () => me),
    logout: vi.fn(async () => {}),
  }
  deps.create.mockImplementation(async (_input, used: string) => {
    if (revoked && used === 'old-token')
      throw new ApiError('unauthorized', 'revoked', { status: 401 })
    return dto
  })
})
afterEach(() => cleanup())

async function sendPayout() {
  const hook = renderHook(() => useFamilyPayout(wallet, () => {}))
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  act(() => hook.result.current.start())
  act(() => hook.result.current.submit(input))
  return hook
}

describe('payout registration session recovery', () => {
  it('renews a rejected cached token and registers the same hash', async () => {
    vi.mocked(deps.session.refreshMe).mockImplementation(async () => {
      if (revoked) cachedToken = 'new-token'
      return me
    })
    const { result } = await sendPayout()
    await waitFor(() => expect(result.current.state.phase).toBe('processing'))
    expect(deps.create.mock.calls.map(([call, used]) => [call.txHash, used])).toEqual([
      [hash, 'old-token'],
      [hash, 'new-token'],
    ])
    expect(send).toHaveBeenCalledOnce()
  })

  it('lets the retry button finish once the session can be renewed', async () => {
    let renewable = false
    vi.mocked(deps.session.refreshMe).mockImplementation(async () => {
      if (renewable) cachedToken = 'new-token'
      return me
    })
    const { result } = await sendPayout()
    await waitFor(() => expect(result.current.state.phase).toBe('registration-pending'))
    renewable = true
    act(() => result.current.retryRegistration())
    await waitFor(() => expect(result.current.state.phase).toBe('processing'))
    expect(deps.create.mock.calls.every(([call]) => call.txHash === hash)).toBe(true)
    expect(deps.create.mock.calls.at(-1)?.[1]).toBe('new-token')
    expect(send).toHaveBeenCalledOnce()
  })

  it('does not register after the account changes during session recovery', async () => {
    const hook = renderHook(() => useFamilyPayout(wallet, () => {}))
    vi.mocked(deps.session.refreshMe).mockImplementation(async () => {
      if (!revoked) return me
      // The dashboard is keyed per account, so a switch unmounts this flow.
      deps.account = { ...deps.account, user: { id: 'privy-other', email: null } }
      cachedToken = 'new-token'
      hook.unmount()
      return me
    })
    await waitFor(() => expect(hook.result.current.ready).toBe(true))
    act(() => hook.result.current.start())
    act(() => hook.result.current.submit(input))
    // Once before the transfer (role check), once for the 401 recovery.
    await waitFor(() => expect(deps.session.refreshMe).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(deps.create).toHaveBeenCalledOnce()
  })
})
