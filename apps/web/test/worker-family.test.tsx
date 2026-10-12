// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkerFamilySection } from '@/components/worker/worker-family-section'
import type { WorkerStreamState } from '@/hooks/use-worker-streams'
import type { SplitSettings, SplitState } from '@/hooks/use-split-settings'
import { ApiError } from '@/lib/api/errors'
import type { RecipientDto } from '@/lib/api/recipients'
import type { Invite } from '@/lib/api/types'
import type { Split } from '@/lib/chain/split'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  listRecipients: vi.fn(),
  deleteRecipient: vi.fn(),
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  cancelInvite: vi.fn(),
  settings: null as unknown as SplitSettings,
}))
vi.mock('@/lib/api/recipients', () => ({
  listRecipients: deps.listRecipients,
  deleteRecipient: deps.deleteRecipient,
}))
vi.mock('@/lib/api/invitations', () => ({
  listFamilyInvitations: deps.listInvites,
  createFamilyInvitation: deps.createInvite,
  cancelInvitation: deps.cancelInvite,
}))
vi.mock('@/hooks/use-split-settings', () => ({ useSplitSettings: () => deps.settings }))

const worker = '0x2222222222222222222222222222222222222222'
const ibu: RecipientDto = {
  id: 'rec-1',
  ownerId: 'user-1',
  userId: 'user-2',
  address: '0x3333333333333333333333333333333333333333',
  displayName: 'Ibu Sari',
  relation: 'Ibu',
  addedAt: '2026-10-12T10:00:00Z',
}
const adik: RecipientDto = {
  ...ibu,
  id: 'rec-2',
  userId: 'user-3',
  address: '0x4444444444444444444444444444444444444444',
  displayName: 'Adik',
  relation: null,
}
const invite: Invite = {
  id: 'inv-1',
  code: 'FAM123',
  type: 'RECIPIENT',
  status: 'PENDING',
  inviteeName: 'Kakak',
  monthlySalaryUsd: null,
  relation: 'Kakak',
  invitedBy: { name: 'Siti', address: worker },
  url: 'http://localhost:3000/f/invite/FAM123',
  expiresAt: '2099-01-01T00:00:00Z',
  acceptedAt: null,
  createdAt: '2026-10-12T10:00:00Z',
}
const session = {
  status: 'ready',
  user: null,
  expiresAt: '2099-01-01T00:00:00Z',
  error: null,
  ensureSession: vi.fn(async () => 'token'),
  refreshMe: vi.fn(async () => null),
  logout: vi.fn(async () => {}),
} as SessionContextValue

function streams(splits: readonly Split[] | null): WorkerStreamState {
  return {
    phase: splits ? 'ready' : 'loading',
    snapshot: splits
      ? {
          streams: [],
          splits,
          walletBalance: BigInt(0),
          blockNumber: BigInt(1),
          blockTimestamp: BigInt(1),
          blockHash: 'h',
          tokenSymbol: 'mAUSD',
        }
      : null,
    timestamp: null,
    error: null,
    refreshing: false,
    refresh: vi.fn(),
  }
}
function settings(state: Partial<SplitState> = {}): SplitSettings {
  return {
    state: { phase: 'idle', splits: null, hash: null, error: null, ...state },
    ready: true,
    save: vi.fn(),
    recheck: vi.fn(),
    reset: vi.fn(),
  }
}
function show(splits: readonly Split[] | null = [{ recipient: ibu.address, bps: 2000 }]) {
  return render(
    <WorkerFamilySection session={session} walletAddress={worker} streams={streams(splits)} />,
  )
}
const dialog = () => screen.getByRole('dialog')

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
  deps.settings = settings()
  deps.listRecipients.mockResolvedValue({ data: [ibu, adik], nextCursor: null })
  deps.listInvites.mockResolvedValue({ data: [invite], nextCursor: null })
  deps.createInvite.mockImplementation(async (input) => ({
    ...invite,
    id: 'inv-2',
    inviteeName: input.inviteeName,
    relation: input.relation ?? null,
    url: 'http://localhost:3000/f/invite/NEW',
  }))
  deps.deleteRecipient.mockResolvedValue(undefined)
  deps.cancelInvite.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('worker family section', () => {
  it('shows the active on-chain split by recipient name and the worker remainder', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText('Kamu menerima 80%')).toBeTruthy()
    expect(screen.getByText('Ibu · 20% dari penarikan')).toBeTruthy()
    expect(screen.getByText('Tidak menerima pembagian')).toBeTruthy()
    expect(screen.getAllByText('Kakak')).toHaveLength(2)
    expect(screen.getByText('Menunggu')).toBeTruthy()
  })

  it('says the split is off when splitsOf is empty and unknown while unread', async () => {
    const view = show([])
    expect(await screen.findByText(/Pembagian ke keluarga tidak aktif/)).toBeTruthy()
    view.unmount()
    show(null)
    expect(
      await screen.findByText('Pembagian aktif belum dapat dibaca dari jaringan.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Atur pembagian' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('distinguishes a failed load from an empty family and retries', async () => {
    deps.listRecipients.mockRejectedValueOnce(new ApiError('network', 'offline'))
    show()
    expect(await screen.findByText('Data keluarga belum dapat dimuat')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })).toBeTruthy()
  })

  it('edits the split from the current value and saves bps', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    const sheet = dialog()
    expect((within(sheet).getByLabelText('Persen') as HTMLInputElement).value).toBe('20')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Tambah penerima' }))
    const selects = within(sheet).getAllByRole('combobox')
    fireEvent.change(selects[1]!, { target: { value: adik.address } })
    fireEvent.change(within(sheet).getAllByLabelText('Persen')[1]!, { target: { value: '12,5' } })
    expect(within(sheet).getByText('Total ke keluarga: 32,5%')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan pembagian' }))
    expect(deps.settings.save).toHaveBeenCalledWith([
      { recipient: ibu.address, bps: 2000 },
      { recipient: adik.address, bps: 1250 },
    ])
  })

  it('blocks duplicates and totals over 100% without saving', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    const sheet = dialog()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Tambah penerima' }))
    fireEvent.change(within(sheet).getAllByRole('combobox')[1]!, { target: { value: ibu.address } })
    fireEvent.change(within(sheet).getAllByLabelText('Persen')[1]!, { target: { value: '10' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan pembagian' }))
    expect(within(sheet).getByText('Penerima ini sudah dipilih.')).toBeTruthy()
    fireEvent.change(within(sheet).getAllByRole('combobox')[1]!, {
      target: { value: adik.address },
    })
    fireEvent.change(within(sheet).getAllByLabelText('Persen')[1]!, { target: { value: '90' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan pembagian' }))
    expect(within(sheet).getByText('Total pembagian melebihi 100%.')).toBeTruthy()
    expect(deps.settings.save).not.toHaveBeenCalled()
  })

  it('caps the form at three recipients', async () => {
    show([
      { recipient: ibu.address, bps: 100 },
      { recipient: adik.address, bps: 100 },
      { recipient: '0x5555555555555555555555555555555555555555', bps: 100 },
    ])
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    expect(within(dialog()).queryByRole('button', { name: 'Tambah penerima' })).toBeNull()
    expect(within(dialog()).getByText('Penerima 0x5555…5555')).toBeTruthy()
  })

  it('turns the split off with setSplits([])', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Matikan pembagian' }))
    expect(deps.settings.save).toHaveBeenCalledWith([])
  })

  it('also saves an empty list when every row is removed', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hapus baris' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Simpan pembagian' }))
    expect(deps.settings.save).toHaveBeenCalledWith([])
  })

  it('offers a status recheck instead of resigning when the outcome is unknown', async () => {
    deps.settings = settings({
      phase: 'unknown',
      splits: [],
      hash: `0x${'a'.repeat(64)}`,
      error: new Error('timeout'),
    })
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Atur pembagian' }))
    const sheet = dialog()
    expect(within(sheet).queryByRole('button', { name: 'Simpan pembagian' })).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Periksa status transaksi' }))
    expect(deps.settings.recheck).toHaveBeenCalledOnce()
    expect(deps.settings.save).not.toHaveBeenCalled()
  })

  it('sends a recipient with an active split to the split form on 409 SPLIT_ACTIVE', async () => {
    deps.deleteRecipient.mockRejectedValue(
      new ApiError('conflict', 'x', { status: 409, code: 'SPLIT_ACTIVE' }),
    )
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hapus penerima' }))
    expect(await within(dialog()).findByText('Penerima masih menerima pembagian')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hapus penerima Ibu Sari' })).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Atur pembagian' }))
    await waitFor(() => expect(within(dialog()).getByText('Simpan pembagian')).toBeTruthy())
    expect(deps.deleteRecipient).toHaveBeenCalledOnce()
  })

  it('removes a recipient without an active split', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus penerima Adik' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Hapus penerima' }))
    await waitFor(() => expect(screen.queryByText('Adik')).toBeNull())
    expect(deps.deleteRecipient).toHaveBeenCalledWith('rec-2', 'token')
  })

  it('creates a family invite and shows its link', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Undang keluarga' }))
    const sheet = dialog()
    fireEvent.change(within(sheet).getByLabelText('Nama'), { target: { value: '  Bapak ' } })
    fireEvent.change(within(sheet).getByLabelText('Hubungan (opsional)'), {
      target: { value: 'Ayah' },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Buat link undangan' }))
    expect(await within(dialog()).findByText('http://localhost:3000/f/invite/NEW')).toBeTruthy()
    expect(deps.createInvite).toHaveBeenCalledWith(
      { inviteeName: 'Bapak', relation: 'Ayah' },
      'token',
    )
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Salin link' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'http://localhost:3000/f/invite/NEW',
      ),
    )
  })

  it('requires a name before creating an invite', async () => {
    show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    fireEvent.click(screen.getByRole('button', { name: 'Undang keluarga' }))
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Buat link undangan' }))
    expect(within(dialog()).getByText('Isi nama 1–100 karakter.')).toBeTruthy()
    expect(deps.createInvite).not.toHaveBeenCalled()
  })

  it('cancels a pending invite and explains an accepted one', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Batalkan undangan Kakak' }))
    await screen.findByText('Dibatalkan')
    expect(deps.cancelInvite).toHaveBeenCalledWith('inv-1', 'token')
    cleanup()
    deps.cancelInvite.mockRejectedValue(
      new ApiError('conflict', 'x', { status: 409, code: 'INVITE_ALREADY_ACCEPTED' }),
    )
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Batalkan undangan Kakak' }))
    expect(await screen.findByText('Undangan sudah diterima')).toBeTruthy()
  })

  it('does not reuse family data after remounting for another account', async () => {
    const view = show()
    await screen.findByRole('button', { name: 'Hapus penerima Ibu Sari' })
    let resolve!: (value: unknown) => void
    deps.listRecipients.mockImplementation(() => new Promise((done) => (resolve = done)))
    view.unmount()
    show()
    expect(screen.queryByRole('button', { name: 'Hapus penerima Ibu Sari' })).toBeNull()
    await waitFor(() => expect(deps.listRecipients).toHaveBeenCalledTimes(2))
    await act(async () => resolve({ data: [], nextCursor: null }))
    expect(await screen.findByText(/Belum ada penerima/)).toBeTruthy()
  })
})
