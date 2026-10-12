// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyDashboard } from '@/components/family/family-dashboard'
import { useFamilyBalance } from '@/hooks/use-family-balance'
import { ApiError } from '@/lib/api/errors'
import { ChainReadError } from '@/lib/chain/types'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  account: {} as Account,
  session: {} as SessionContextValue,
  read: vi.fn(),
  fx: vi.fn(),
}))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/chain/family-balance', () => ({ readFamilyBalance: deps.read }))
vi.mock('@/lib/api/fx', () => ({ getUsdIdr: deps.fx }))
vi.mock('@/components/family/bank-account-list', () => ({ BankAccountList: () => null }))

const b = BigInt
const wallet = '0x2222222222222222222222222222222222222222'
const other = '0x3333333333333333333333333333333333333333'
const snapshot = {
  balance: b(12_500_000),
  blockNumber: b(20),
  blockHash: '0xhash',
  blockTimestamp: b(1000),
  tokenSymbol: 'mAUSD',
}
const quote = {
  base: 'USD',
  quote: 'IDR',
  rate: 16250,
  source: 'live',
  rateTime: '2026-10-12T10:00:00Z',
  fetchedAt: '2026-10-12T10:01:00Z',
}
const me = {
  id: 'user-3',
  displayName: 'Ibu Sari',
  address: wallet,
  createdAt: '2026-10-10T10:00:00Z',
  companyId: null,
  roles: { employer: false, worker: false, recipient: true },
}

beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  deps.account = {
    configured: true,
    ready: true,
    authenticated: true,
    user: { id: 'did:privy:family', email: 'sari@example.com' },
    walletAddress: wallet,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => 'privy'),
    sendTransaction: vi.fn(async () => ({ hash: `0x${'a'.repeat(64)}` as `0x${string}` })),
  }
  deps.session = {
    status: 'ready',
    user: me,
    expiresAt: '2099-01-01T00:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => 'trickle-token'),
    refreshMe: vi.fn(async () => me),
    logout: vi.fn(async () => {}),
  }
  deps.read.mockResolvedValue(snapshot)
  deps.fx.mockResolvedValue(quote)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('family dashboard', () => {
  it('shows the received balance with a rupiah estimate and demo label', async () => {
    render(<FamilyDashboard />)
    expect((await screen.findByTestId('family-balance-idr')).textContent).toBe('≈ Rp203.125')
    expect(screen.getByTestId('family-balance-token').textContent).toBe('12,5 mAUSD')
    expect(screen.getByText('Aset demo')).toBeTruthy()
    expect(screen.getByText('Halo, Ibu Sari')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(deps.read).toHaveBeenCalledWith(wallet, expect.any(AbortSignal))
    expect(deps.fx).toHaveBeenCalledWith('trickle-token', expect.anything())
    expect(screen.getByRole('button', { name: 'Cairkan' }).hasAttribute('disabled')).toBe(true)
  })

  it('keeps the token balance when the rate is unavailable', async () => {
    deps.fx.mockRejectedValue(new ApiError('server', 'down', { status: 503 }))
    render(<FamilyDashboard />)
    await screen.findByText('Rupiah belum tersedia')
    expect(screen.getByTestId('family-balance-token').textContent).toBe('12,5 mAUSD')
    expect(screen.queryByTestId('family-balance-idr')).toBeNull()
  })

  it('never shows a zero balance when the RPC read fails', async () => {
    deps.read.mockRejectedValue(new Error('rpc down'))
    render(<FamilyDashboard />)
    await screen.findByText('Belum dapat membaca saldo')
    expect(screen.getByText('Saldo belum tersedia')).toBeTruthy()
    expect(screen.queryByText(/Rp0/)).toBeNull()
    expect(screen.queryByTestId('family-balance-token')).toBeNull()
  })

  it('maps a deployment mismatch to a configuration message', async () => {
    deps.read.mockRejectedValue(new ChainReadError('DEPLOYMENT_MISMATCH'))
    render(<FamilyDashboard />)
    await screen.findByText('Konfigurasi jaringan belum sesuai')
  })

  it('distinguishes a verified zero balance', async () => {
    deps.read.mockResolvedValue({ ...snapshot, balance: b(0) })
    render(<FamilyDashboard />)
    expect((await screen.findByTestId('family-balance-idr')).textContent).toBe('≈ Rp0')
    expect(screen.getByText('Belum ada dana diterima')).toBeTruthy()
  })

  it('shows rate source, rate time and block in Info detail', async () => {
    render(<FamilyDashboard />)
    await screen.findByTestId('family-balance-idr')
    fireEvent.click(screen.getByRole('button', { name: 'Info detail' }))
    const sheet = screen.getByRole('dialog', { name: 'Rincian dana' })
    expect(within(sheet).getByText('Langsung')).toBeTruthy()
    expect(within(sheet).getByText('16.250')).toBeTruthy()
    expect(within(sheet).getByText('20')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Perbarui saldo' }))
    await waitFor(() => expect(deps.read).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(deps.fx).toHaveBeenCalledTimes(2))
  })

  it('asks a non-recipient to accept an invitation without reading the balance', () => {
    deps.session = {
      ...deps.session,
      user: { ...me, roles: { employer: false, worker: true, recipient: false } },
    }
    render(<FamilyDashboard />)
    expect(screen.getByText('Akun belum terhubung sebagai keluarga')).toBeTruthy()
    expect(deps.read).not.toHaveBeenCalled()
    expect(deps.fx).not.toHaveBeenCalled()
  })

  it('asks signed-out users to log in without protected reads', () => {
    deps.account = { ...deps.account, authenticated: false, user: null }
    deps.session = { ...deps.session, status: 'signed-out', user: null }
    render(<FamilyDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(deps.account.login).toHaveBeenCalledOnce()
    expect(deps.read).not.toHaveBeenCalled()
  })

  it('blocks reads while the session is exchanging', () => {
    deps.session = { ...deps.session, status: 'exchanging', user: null }
    render(<FamilyDashboard />)
    expect(screen.getByRole('status', { name: 'Memuat dashboard' })).toBeTruthy()
    expect(deps.read).not.toHaveBeenCalled()
  })

  it('offers recovery on a session error', async () => {
    deps.session = { ...deps.session, status: 'error', user: null }
    render(<FamilyDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui sesi' }))
    await waitFor(() => expect(deps.session.refreshMe).toHaveBeenCalledOnce())
    expect(deps.read).not.toHaveBeenCalled()
  })

  it('refuses to read when the active wallet differs from the session', () => {
    deps.account = { ...deps.account, walletAddress: other }
    render(<FamilyDashboard />)
    expect(screen.getByText('Wallet tidak sesuai dengan sesi')).toBeTruthy()
    expect(deps.read).not.toHaveBeenCalled()
  })

  it('does not show the previous account balance after switching accounts', async () => {
    const view = render(<FamilyDashboard />)
    await screen.findByTestId('family-balance-idr')
    let resolve!: (value: typeof snapshot) => void
    deps.read.mockImplementation(() => new Promise((done) => (resolve = done)))
    deps.account = {
      ...deps.account,
      user: { id: 'did:privy:other', email: null },
      walletAddress: other,
    }
    deps.session = { ...deps.session, user: { ...me, id: 'user-4', address: other } }
    view.rerender(<FamilyDashboard />)
    await screen.findByText('Membaca saldo di jaringan...')
    expect(screen.queryByTestId('family-balance-idr')).toBeNull()
    await act(async () => resolve({ ...snapshot, balance: b(1_000_000) }))
    expect(screen.getByTestId('family-balance-token').textContent).toBe('1 mAUSD')
    expect(deps.read).toHaveBeenLastCalledWith(other, expect.any(AbortSignal))
  })
})

function Harness({ address }: { address: string }) {
  const state = useFamilyBalance(address)
  return (
    <div>
      <span data-testid="phase">{state.phase}</span>
      <span data-testid="balance">{state.snapshot?.balance.toString() ?? 'unknown'}</span>
    </div>
  )
}

describe('family balance polling', () => {
  it('polls every 15 seconds without a per-second ticker', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness address={wallet} />)
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('ready'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14000)
    })
    expect(deps.read).toHaveBeenCalledOnce()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(deps.read).toHaveBeenCalledTimes(2)
  })

  it('keeps the last snapshot but marks it stale after a failed refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness address={wallet} />)
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('ready'))
    deps.read.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByTestId('phase').textContent).toBe('stale')
    expect(screen.getByTestId('balance').textContent).toBe('12500000')
  })

  it('marks a hung refresh stale after 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness address={wallet} />)
    await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('ready'))
    deps.read.mockImplementation(() => new Promise(() => {}))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByTestId('phase').textContent).toBe('stale')
  })

  it('stops polling after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const view = render(<Harness address={wallet} />)
    await waitFor(() => expect(deps.read).toHaveBeenCalledOnce())
    view.unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000)
    })
    expect(deps.read).toHaveBeenCalledOnce()
  })

  it('ignores a late response for the previous wallet', async () => {
    let resolveOld!: (value: typeof snapshot) => void
    deps.read.mockImplementationOnce(() => new Promise((done) => (resolveOld = done)))
    const view = render(<Harness address={wallet} />)
    await waitFor(() => expect(deps.read).toHaveBeenCalledOnce())
    deps.read.mockResolvedValue({ ...snapshot, balance: b(7) })
    view.rerender(<Harness address={other} />)
    await waitFor(() => expect(screen.getByTestId('balance').textContent).toBe('7'))
    await act(async () => resolveOld(snapshot))
    expect(screen.getByTestId('balance').textContent).toBe('7')
  })
})
