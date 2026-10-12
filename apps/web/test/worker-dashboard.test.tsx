// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { WorkerDashboard } from '@/components/worker/worker-dashboard'
import { ApiError } from '@/lib/api/errors'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  account: {} as Account,
  session: {} as SessionContextValue,
  list: vi.fn(),
}))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/api/worker', () => ({ listMyEmployments: deps.list }))
const employment = {
  id: 'job-1',
  displayName: 'Siti',
  monthlySalaryUsd: 800,
  joinedAt: '2026-10-11T00:00:00Z',
  employer: { id: 'company-1', name: 'PT Maju Jaya', country: 'MY', ownerAddress: '0x1111' },
}
const me = {
  id: 'user-1',
  displayName: 'Siti',
  address: '0x2222',
  createdAt: employment.joinedAt,
  companyId: null,
  roles: { employer: false, worker: true, recipient: false },
}
beforeEach(() => {
  vi.clearAllMocks()
  deps.account = {
    configured: true,
    ready: true,
    authenticated: true,
    user: { id: 'privy-1', email: 'siti@example.com' },
    walletAddress: me.address,
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
    ensureSession: vi.fn(async () => 'token'),
    refreshMe: vi.fn(async () => me),
    logout: vi.fn(async () => {}),
  }
  deps.list.mockResolvedValue({ data: [employment], nextCursor: null })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('worker dashboard', () => {
  it('shows real employment metadata without claiming a balance, stream, or family membership', async () => {
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    expect(screen.getByText('$800 / bulan')).toBeTruthy()
    expect(screen.getByText('11 Okt')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tarik gaji' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Saldo belum tersedia')).toBeTruthy()
    expect(screen.getByText('Data keluarga belum tersedia')).toBeTruthy()
    expect(screen.queryByText('Rp0')).toBeNull()
    expect(screen.queryByText('0x1111')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
  it('asks signed-out users to log in without fetching protected data', () => {
    deps.account = { ...deps.account, authenticated: false, user: null }
    deps.session = { ...deps.session, status: 'signed-out', user: null }
    render(<WorkerDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(deps.account.login).toHaveBeenCalledOnce()
    expect(deps.list).not.toHaveBeenCalled()
  })
  it('does not fetch before account/session readiness', () => {
    deps.session = { ...deps.session, status: 'exchanging', user: null }
    render(<WorkerDashboard />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(deps.list).not.toHaveBeenCalled()
  })
  it('handles missing Privy configuration', () => {
    deps.account = { ...deps.account, configured: false }
    render(<WorkerDashboard />)
    expect(screen.getByText('Login belum tersedia')).toBeTruthy()
    expect(deps.list).not.toHaveBeenCalled()
  })
  it('distinguishes a genuine empty page from failed requests, even with worker role', async () => {
    deps.list.mockResolvedValue({ data: [], nextCursor: null })
    render(<WorkerDashboard />)
    await screen.findByText('Belum ada pekerjaan terhubung')
    expect(screen.queryByText('Belum dapat memuat pekerjaan')).toBeNull()
  })
  it('does not treat a missing backend route as an empty page and allows manual retry', async () => {
    deps.list.mockRejectedValueOnce(new ApiError('not-found', 'missing', { status: 404 }))
    render(<WorkerDashboard />)
    await screen.findByText('Belum dapat memuat pekerjaan')
    expect(screen.queryByText('Belum ada pekerjaan terhubung')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByText('PT Maju Jaya')
  })
  it('loads multiple employers, deduplicates paginated rows and uses the server cursor', async () => {
    deps.list
      .mockResolvedValueOnce({ data: [employment], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({
        data: [
          employment,
          { ...employment, id: 'job-2', employer: { ...employment.employer, name: 'PT Kedua' } },
        ],
        nextCursor: null,
      })
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    fireEvent.click(screen.getByRole('button', { name: 'Muat pekerjaan lainnya' }))
    await screen.findByText('PT Kedua')
    expect(screen.getAllByText('PT Maju Jaya')).toHaveLength(1)
    expect(deps.list.mock.calls[1]![1]).toBe('cursor-1')
  })
  it('keeps loaded rows on pagination failure and prevents duplicate clicks', async () => {
    deps.list
      .mockResolvedValueOnce({ data: [employment], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new Error('offline'))
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    const more = screen.getByRole('button', { name: 'Muat pekerjaan lainnya' })
    fireEvent.click(more)
    fireEvent.click(more)
    await screen.findByText('Pekerjaan berikutnya belum dapat dimuat')
    expect(screen.getByText('PT Maju Jaya')).toBeTruthy()
    expect(deps.list).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Muat pekerjaan lainnya' })).toBeTruthy()
  })
  it('recovers a rejected token once but never loops on repeated 401', async () => {
    deps.list.mockRejectedValue(new ApiError('unauthorized', 'expired', { status: 401 }))
    render(<WorkerDashboard />)
    await screen.findByText('Sesi perlu diperbarui')
    expect(deps.session.refreshMe).toHaveBeenCalledOnce()
    expect(deps.list).toHaveBeenCalledTimes(2)
  })
  it('honors rate limit cooldown for retries', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockRejectedValueOnce(
      new ApiError('rate-limited', 'wait', { status: 429, retryAfterMs: 30000 }),
    )
    render(<WorkerDashboard />)
    await screen.findByText('Terlalu banyak permintaan')
    expect(screen.getByRole('button', { name: 'Coba lagi' }).hasAttribute('disabled')).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30001)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByText('PT Maju Jaya')
  })
  it('aborts requests and discards old data immediately on account switch', async () => {
    let resolve!: (value: unknown) => void
    deps.list.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const view = render(<WorkerDashboard />)
    await waitFor(() => expect(deps.list).toHaveBeenCalledOnce())
    const signal = deps.list.mock.calls[0]![2].signal as AbortSignal
    deps.account = {
      ...deps.account,
      user: { id: 'privy-2', email: null },
      walletAddress: '0x3333',
    }
    deps.session = {
      ...deps.session,
      user: { ...me, id: 'user-2', displayName: 'Budi', address: '0x3333' },
    }
    deps.list.mockResolvedValue({ data: [], nextCursor: null })
    view.rerender(<WorkerDashboard />)
    await screen.findByText('Belum ada pekerjaan terhubung')
    await act(async () => {
      resolve({ data: [employment], nextCursor: null })
    })
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('PT Maju Jaya')).toBeNull()
  })
  it('hides employment immediately after logout', async () => {
    const view = render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    deps.account = { ...deps.account, authenticated: false, user: null }
    view.rerender(<WorkerDashboard />)
    expect(screen.queryByText('PT Maju Jaya')).toBeNull()
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeTruthy()
  })
  it('recovers session errors explicitly', async () => {
    deps.session = { ...deps.session, status: 'error', error: new Error('offline') }
    render(<WorkerDashboard />)
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui sesi' }))
    await waitFor(() => expect(deps.session.refreshMe).toHaveBeenCalledOnce())
    expect(deps.list).not.toHaveBeenCalled()
  })
  it('does not fetch metadata for a stale profile belonging to another wallet', () => {
    deps.account = { ...deps.account, walletAddress: '0x9999' }
    render(<WorkerDashboard />)
    expect(screen.getByText('Wallet tidak sesuai dengan sesi')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui sesi' }))
    expect(deps.session.refreshMe).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Keluar' }))
    expect(deps.session.logout).toHaveBeenCalledOnce()
    expect(deps.list).not.toHaveBeenCalled()
  })
  it('aborts the in-flight request when the dashboard unmounts', async () => {
    deps.list.mockImplementationOnce(() => new Promise(() => {}))
    const view = render(<WorkerDashboard />)
    await waitFor(() => expect(deps.list).toHaveBeenCalledOnce())
    const signal = deps.list.mock.calls[0]![2].signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('loads correctly under StrictMode without duplicate requests', async () => {
    render(
      <StrictMode>
        <WorkerDashboard />
      </StrictMode>,
    )
    await screen.findByText('PT Maju Jaya')
    expect(deps.list).toHaveBeenCalledOnce()
  })
  it('rejects a repeated pagination cursor without losing loaded jobs', async () => {
    deps.list.mockResolvedValue({ data: [employment], nextCursor: 'cursor-1' })
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    fireEvent.click(screen.getByRole('button', { name: 'Muat pekerjaan lainnya' }))
    await screen.findByText('Informasi pekerjaan belum dapat ditampilkan')
    expect(screen.getAllByText('PT Maju Jaya')).toHaveLength(1)
  })
})
