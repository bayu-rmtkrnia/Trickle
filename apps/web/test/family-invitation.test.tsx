// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyInvitation } from '@/components/family/family-invitation'
import { ApiError } from '@/lib/api/errors'
import type { Invite } from '@/lib/api/types'
import type { Account } from '@/lib/account'
import type { SessionContextValue } from '@/providers/session-provider'

const dependencies = vi.hoisted(() => ({
  account: {} as Account,
  session: {} as SessionContextValue,
  navigate: vi.fn(),
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
}))
vi.mock('@/lib/account', () => ({ useAccount: () => dependencies.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => dependencies.session }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: dependencies.navigate }) }))
vi.mock('@/lib/api/invitations', () => ({
  getInvitation: dependencies.getInvitation,
  acceptInvitation: dependencies.acceptInvitation,
}))

const invitation: Invite = {
  id: 'invite-2',
  code: 'FAMILY1234',
  type: 'RECIPIENT',
  status: 'PENDING',
  inviteeName: 'Ibu',
  monthlySalaryUsd: null,
  relation: 'Ibu',
  invitedBy: { name: 'Siti', address: '0x1111111111111111111111111111111111111111' },
  url: 'http://localhost:3000/f/invite/FAMILY1234',
  expiresAt: '2099-10-17T10:00:00Z',
  acceptedAt: null,
  createdAt: '2026-10-10T10:00:00Z',
}
const me = {
  id: 'user-3',
  displayName: 'Ibu',
  address: '0x3333',
  createdAt: invitation.createdAt,
  companyId: null,
  roles: { employer: false, worker: false, recipient: true },
}

beforeEach(() => {
  vi.clearAllMocks()
  dependencies.account = {
    configured: true,
    ready: true,
    authenticated: true,
    user: { id: 'did:privy:family', email: 'ibu@example.com' },
    walletAddress: me.address,
    login: vi.fn(),
    logout: vi.fn(async () => {}),
    getAccessToken: vi.fn(async () => 'privy'),
    sendTransaction: vi.fn(async () => ({ hash: `0x${'a'.repeat(64)}` as `0x${string}` })),
  }
  dependencies.session = {
    status: 'ready',
    user: me,
    expiresAt: '2099-10-17T10:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => 'trickle-token'),
    refreshMe: vi.fn(async () => me),
    logout: vi.fn(async () => {}),
  }
  dependencies.getInvitation.mockResolvedValue(invitation)
  dependencies.acceptInvitation.mockResolvedValue({ ...invitation, status: 'ACCEPTED' })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function show() {
  const view = render(<FamilyInvitation code="FAMILY1234" />)
  await screen.findByText('Siti')
  return view
}

describe('family invitation onboarding', () => {
  it('loads public metadata and only accepts after an explicit click', async () => {
    await show()
    expect(screen.getAllByText('Ibu').length).toBeGreaterThan(0)
    expect(dependencies.acceptInvitation).not.toHaveBeenCalled()
    expect(screen.queryByText(invitation.invitedBy.address)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await waitFor(() => expect(dependencies.navigate).toHaveBeenCalledWith('/f'))
    expect(dependencies.acceptInvitation).toHaveBeenCalledWith('FAMILY1234', 'trickle-token')
    expect(dependencies.session.refreshMe).toHaveBeenCalledOnce()
  })

  it('keeps the invitation and does not accept when login is cancelled', async () => {
    dependencies.account = { ...dependencies.account, authenticated: false, user: null }
    const view = await show()
    fireEvent.click(screen.getByRole('button', { name: 'Masuk untuk melanjutkan' }))
    expect(dependencies.account.login).toHaveBeenCalledOnce()
    view.rerender(<FamilyInvitation code="FAMILY1234" />)
    expect(screen.getByRole('button', { name: 'Masuk untuk melanjutkan' })).toBeTruthy()
    expect(dependencies.acceptInvitation).not.toHaveBeenCalled()
    expect(dependencies.navigate).not.toHaveBeenCalled()
    dependencies.account = {
      ...dependencies.account,
      authenticated: true,
      user: { id: 'did:privy:family', email: null },
    }
    view.rerender(<FamilyInvitation code="FAMILY1234" />)
    expect(screen.getByRole('button', { name: 'Terima undangan' })).toBeTruthy()
    expect(dependencies.acceptInvitation).not.toHaveBeenCalled()
  })

  it('prevents two acceptance requests while a mutation is pending', async () => {
    let resolve!: (value: Invite) => void
    dependencies.acceptInvitation.mockImplementation(
      () =>
        new Promise<Invite>((done) => {
          resolve = done
        }),
    )
    await show()
    const button = screen.getByRole('button', { name: 'Terima undangan' })
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(dependencies.acceptInvitation).toHaveBeenCalledOnce())
    resolve({ ...invitation, status: 'ACCEPTED' })
    await waitFor(() => expect(dependencies.navigate).toHaveBeenCalledWith('/f'))
  })

  it('rejects a worker invitation on the family route', async () => {
    dependencies.getInvitation.mockResolvedValue({ ...invitation, type: 'WORKER' })
    render(<FamilyInvitation code="FAMILY1234" />)
    await screen.findByRole('heading', { name: 'Ini undangan worker' })
    expect(screen.queryByRole('button', { name: 'Terima undangan' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Buka undangan worker' }).getAttribute('href')).toBe(
      '/w/invite/FAMILY1234',
    )
  })

  it.each([
    ['EXPIRED', 'Undangan kedaluwarsa'],
    ['REVOKED', 'Undangan dibatalkan'],
    ['ACCEPTED', 'Undangan sudah digunakan'],
  ] as const)('blocks acceptance for public status %s', async (status, heading) => {
    dependencies.getInvitation.mockResolvedValue({ ...invitation, status })
    render(<FamilyInvitation code="FAMILY1234" />)
    await screen.findByRole('heading', { name: heading })
    expect(screen.queryByRole('button', { name: 'Terima undangan' })).toBeNull()
  })

  it('does not claim an accepted invitation belongs to the current account after reload', async () => {
    dependencies.getInvitation.mockResolvedValue({ ...invitation, status: 'ACCEPTED' })
    render(<FamilyInvitation code="FAMILY1234" />)
    await screen.findByRole('heading', { name: 'Undangan sudah digunakan' })
    expect(screen.getByRole('link', { name: 'Buka dashboard keluarga' }).getAttribute('href')).toBe(
      '/f',
    )
    expect(dependencies.navigate).not.toHaveBeenCalled()
  })

  it.each([
    [410, 'INVITE_EXPIRED', 'Undangan kedaluwarsa'],
    [409, 'INVITE_REVOKED', 'Undangan dibatalkan'],
    [409, 'INVITE_ALREADY_ACCEPTED', 'Undangan sudah digunakan'],
    [400, 'CANNOT_ACCEPT_OWN_INVITE', 'Tidak dapat menerima undangan sendiri'],
    [409, 'ALREADY_LINKED', 'Akun sudah terhubung'],
    [401, 'UNAUTHORIZED', 'Sesi perlu diperbarui'],
    [429, 'RATE_LIMITED', 'Terlalu banyak permintaan'],
  ])(
    'shows recoverable API error %s/%s without replaying acceptance',
    async (status, code, heading) => {
      dependencies.acceptInvitation.mockRejectedValue(
        new ApiError('server', 'Raw backend text', { status: Number(status), code: String(code) }),
      )
      await show()
      fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
      await screen.findByText(String(heading))
      expect(screen.queryByText('Raw backend text')).toBeNull()
      expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
      expect(dependencies.navigate).not.toHaveBeenCalled()
    },
  )

  it('retries only profile refresh after acceptance already succeeded', async () => {
    vi.mocked(dependencies.session.refreshMe).mockRejectedValueOnce(
      new ApiError('network', 'Offline'),
    )
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await screen.findByText('Undangan diterima, profil belum diperbarui')
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui profil' }))
    await waitFor(() => expect(dependencies.navigate).toHaveBeenCalledWith('/f'))
    expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
    expect(dependencies.session.refreshMe).toHaveBeenCalledTimes(2)
  })

  it('shows progress while the accepted account profile is still refreshing', async () => {
    let resolve!: (value: typeof me) => void
    vi.mocked(dependencies.session.refreshMe).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await waitFor(() => expect(dependencies.session.refreshMe).toHaveBeenCalledOnce())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Memperbarui profil…')
    await act(async () => {
      resolve(me)
    })
    expect(dependencies.navigate).toHaveBeenCalledWith('/f')
  })

  it('checks public status after an uncertain acceptance outcome', async () => {
    dependencies.acceptInvitation.mockRejectedValue(new ApiError('network', 'Connection lost'))
    dependencies.getInvitation
      .mockResolvedValueOnce(invitation)
      .mockResolvedValueOnce({ ...invitation, status: 'ACCEPTED' })
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await screen.findByRole('heading', { name: 'Undangan sudah digunakan' })
    expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
    expect(dependencies.navigate).not.toHaveBeenCalled()
  })

  it('ignores acceptance completion after the account changes', async () => {
    let resolve!: (value: Invite) => void
    dependencies.acceptInvitation.mockImplementation(
      () =>
        new Promise<Invite>((done) => {
          resolve = done
        }),
    )
    const view = await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await waitFor(() => expect(dependencies.acceptInvitation).toHaveBeenCalledOnce())
    dependencies.account = { ...dependencies.account, user: { id: 'did:privy:other', email: null } }
    view.rerender(<FamilyInvitation code="FAMILY1234" />)
    resolve({ ...invitation, status: 'ACCEPTED' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Terima undangan' })).toBeTruthy(),
    )
    expect(dependencies.navigate).not.toHaveBeenCalled()
    expect(dependencies.session.refreshMe).not.toHaveBeenCalled()
  })

  it('offers retry after public lookup fails', async () => {
    dependencies.getInvitation
      .mockRejectedValueOnce(new ApiError('network', 'Offline'))
      .mockResolvedValueOnce(invitation)
    render(<FamilyInvitation code="FAMILY1234" />)
    await screen.findByText('Undangan belum dapat dimuat')
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByText('Siti')
  })

  it('waits for Retry-After before retrying a public lookup', async () => {
    dependencies.getInvitation.mockRejectedValueOnce(
      new ApiError('rate-limited', 'Wait', { status: 429, retryAfterMs: 3000 }),
    )
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await act(async () => {
      render(<FamilyInvitation code="FAMILY1234" />)
    })
    const retry = screen.getByRole('button', { name: 'Coba lagi' }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(retry.disabled).toBe(false)
    await act(async () => {
      fireEvent.click(retry)
    })
    expect(screen.getByText('Siti')).toBeTruthy()
  })

  it('does not post acceptance when the backend session is unavailable', async () => {
    vi.mocked(dependencies.session.ensureSession).mockResolvedValue(null)
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await screen.findByText('Sesi perlu diperbarui')
    expect(dependencies.acceptInvitation).not.toHaveBeenCalled()
  })

  it('requires session recovery before retrying a rejected 401 mutation', async () => {
    dependencies.acceptInvitation.mockRejectedValueOnce(
      new ApiError('unauthorized', 'Expired', { status: 401 }),
    )
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await screen.findByText('Sesi perlu diperbarui')
    expect(
      (screen.getByRole('button', { name: 'Terima undangan' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui profil' }))
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Terima undangan' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    )
    expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
    expect(dependencies.session.refreshMe).toHaveBeenCalledOnce()
  })

  it('honors the server cooldown without replaying a rate-limited acceptance', async () => {
    dependencies.acceptInvitation.mockRejectedValueOnce(
      new ApiError('rate-limited', 'Wait', { status: 429, retryAfterMs: 3000 }),
    )
    await show()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    })
    expect(
      (screen.getByRole('button', { name: 'Terima undangan' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999)
    })
    expect(
      (screen.getByRole('button', { name: 'Terima undangan' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(
      (screen.getByRole('button', { name: 'Terima undangan' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
  })

  it('does not refresh a profile or navigate after acceptance completes on an unmounted page', async () => {
    let resolve!: (value: Invite) => void
    dependencies.acceptInvitation.mockImplementation(
      () =>
        new Promise<Invite>((done) => {
          resolve = done
        }),
    )
    const view = await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await waitFor(() => expect(dependencies.acceptInvitation).toHaveBeenCalledOnce())
    view.unmount()
    await act(async () => {
      resolve({ ...invitation, status: 'ACCEPTED' })
    })
    expect(dependencies.navigate).not.toHaveBeenCalled()
    expect(dependencies.session.refreshMe).not.toHaveBeenCalled()
  })

  it('blocks acceptance until public status can be checked after an uncertain response', async () => {
    dependencies.acceptInvitation.mockRejectedValueOnce(new ApiError('network', 'Lost response'))
    dependencies.getInvitation
      .mockResolvedValueOnce(invitation)
      .mockRejectedValueOnce(new ApiError('network', 'Offline'))
      .mockResolvedValueOnce(invitation)
    await show()
    fireEvent.click(screen.getByRole('button', { name: 'Terima undangan' }))
    await screen.findByRole('button', { name: 'Periksa status undangan' })
    expect(screen.queryByRole('button', { name: 'Terima undangan' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Periksa status undangan' }))
    await screen.findByRole('button', { name: 'Terima undangan' })
    expect(dependencies.acceptInvitation).toHaveBeenCalledOnce()
  })
})
