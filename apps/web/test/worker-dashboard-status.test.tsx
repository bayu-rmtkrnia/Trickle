// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerDashboard } from '@/components/worker/worker-dashboard'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  account: {} as Account,
  session: {} as SessionContextValue,
  list: vi.fn(),
  streams: {} as Record<string, unknown>,
}))
vi.mock('@/hooks/use-worker-streams', () => ({ useWorkerStreams: () => deps.streams }))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/components/auth/sign-out-button', () => ({
  SignOutButton: () => <button type="button">Keluar</button>,
}))
vi.mock('@/components/ui/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Bahasa</button>,
}))
vi.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}))
vi.mock('@/lib/api/worker', () => ({ listMyEmployments: deps.list }))
vi.mock('@/lib/api/recipients', () => ({
  listRecipients: vi.fn(async () => ({ data: [], nextCursor: null })),
  deleteRecipient: vi.fn(),
}))
vi.mock('@/lib/api/invitations', () => ({
  listFamilyInvitations: vi.fn(async () => ({ data: [], nextCursor: null })),
  createFamilyInvitation: vi.fn(),
  cancelInvitation: vi.fn(),
}))
const employer = '0x1111111111111111111111111111111111111111'
const b = BigInt
const stream = {
  id: b(1),
  employer,
  worker: '0x2222',
  amount: b(1000),
  withdrawn: b(0),
  refunded: b(0),
  start: b(100),
  end: b(200),
  canceled: false,
}
const withStreams = (streams: unknown[], timestamp: bigint | null = b(150)) => ({
  phase: 'ready',
  snapshot:
    streams && timestamp !== null
      ? { streams, splits: [], walletBalance: b(0), tokenSymbol: 'mAUSD' }
      : null,
  timestamp,
  refresh: vi.fn(),
  refreshing: false,
  error: null,
})
const employment = {
  id: 'job-1',
  displayName: 'Siti',
  monthlySalaryUsd: 800,
  joinedAt: '2026-10-11T00:00:00Z',
  employer: { id: 'company-1', name: 'PT Maju Jaya', country: 'MY', ownerAddress: employer },
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
  deps.streams = withStreams([stream])
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('worker dashboard employer payroll status', () => {
  it('shows the live stream status for each employer', async () => {
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    expect(screen.getByText('Aktif')).toBeTruthy()
    expect(screen.queryByText('Status payroll belum tersedia')).toBeNull()
  })
  it('says no stream exists when the employer has not funded one', async () => {
    deps.streams = withStreams([
      { ...stream, employer: '0x3333333333333333333333333333333333333333' },
    ])
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    expect(screen.getByText('Belum ada aliran gaji')).toBeTruthy()
  })
  it('keeps the unknown label while chain data is unavailable', async () => {
    deps.streams = withStreams([], null)
    render(<WorkerDashboard />)
    await screen.findByText('PT Maju Jaya')
    expect(screen.getByText('Status payroll belum tersedia')).toBeTruthy()
  })
})
