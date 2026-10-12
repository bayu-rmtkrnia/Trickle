// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BankAccountList } from '@/components/family/bank-account-list'
import { useBankAccounts } from '@/hooks/use-bank-accounts'
import { ApiError } from '@/lib/api/errors'
import type { BankAccountDto } from '@/lib/api/bank-accounts'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/lib/api/bank-accounts', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/bank-accounts')>()),
  listBankAccounts: deps.list,
  createBankAccount: deps.create,
  updateBankAccount: deps.update,
  deleteBankAccount: deps.remove,
}))

const account = (id: string, last4: string, extra: Partial<BankAccountDto> = {}) => ({
  id,
  bankCode: 'BCA' as const,
  accountName: 'Sari Wulandari',
  label: null,
  accountNumberLast4: last4,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
  ...extra,
})
let session: SessionContextValue

function Harness() {
  return <BankAccountList bank={useBankAccounts(session)} />
}

beforeEach(() => {
  vi.clearAllMocks()
  // Sheet keeps a marker in history.state; start every test from a clean entry.
  window.history.replaceState(null, '')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  session = {
    status: 'ready',
    user: null,
    expiresAt: '2099-01-01T00:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => 'trickle-token'),
    refreshMe: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
  }
  deps.list.mockResolvedValue({ data: [account('bank-1', '0123')], nextCursor: null })
  deps.create.mockImplementation(async (input) =>
    account('bank-new', input.accountNumber.slice(-4), {
      bankCode: input.bankCode,
      accountName: input.accountName,
      label: input.label ?? null,
    }),
  )
  deps.update.mockImplementation(async (id, input) => account(id, '0123', input))
  deps.remove.mockResolvedValue(undefined)
})
afterEach(() => cleanup())

function dialog(name: string) {
  return screen.getByRole('dialog', { name })
}
async function openAdd() {
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: 'Tambah rekening' }))
  return dialog('Tambah rekening')
}
function fill(sheet: HTMLElement, values: Record<string, string>) {
  for (const [label, value] of Object.entries(values))
    fireEvent.change(within(sheet).getByLabelText(label), { target: { value } })
}

describe('family bank accounts', () => {
  it('lists bank and last 4 digits only', async () => {
    render(<Harness />)
    expect(await screen.findByText('BCA')).toBeTruthy()
    expect(screen.getByText('Sari Wulandari · •••• 0123')).toBeTruthy()
    expect(deps.list).toHaveBeenCalledWith('trickle-token', undefined, expect.anything())
  })

  it('shows an empty state that differs from a load failure', async () => {
    deps.list.mockResolvedValueOnce({ data: [], nextCursor: null })
    const view = render(<Harness />)
    expect(await screen.findByText('Belum ada rekening')).toBeTruthy()
    view.unmount()

    deps.list.mockRejectedValueOnce(new ApiError('network', 'offline'))
    render(<Harness />)
    expect(await screen.findByText('Rekening belum dapat dimuat')).toBeTruthy()
    expect(screen.queryByText('Belum ada rekening')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByText('BCA')).toBeTruthy()
  })

  it('loads the next page and drops duplicate ids', async () => {
    deps.list
      .mockResolvedValueOnce({ data: [account('bank-1', '0123')], nextCursor: 'c2' })
      .mockResolvedValueOnce({
        data: [account('bank-1', '0123'), account('bank-2', '4567')],
        nextCursor: null,
      })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Muat rekening lainnya' }))
    expect(await screen.findByText('Sari Wulandari · •••• 4567')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(deps.list).toHaveBeenLastCalledWith('trickle-token', 'c2', expect.anything())
  })

  it('adds an account, keeps leading zeros and clears the number afterwards', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const sheet = await openAdd()
    fireEvent.change(within(sheet).getByLabelText('Bank'), { target: { value: 'BNI' } })
    fill(sheet, {
      'Nomor rekening': '0012 3456-78',
      'Nama pemilik rekening': '  Sari  ',
      'Label (opsional)': '   ',
    })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan rekening' }))
    await waitFor(() =>
      expect(deps.create).toHaveBeenCalledWith(
        { bankCode: 'BNI', accountNumber: '0012345678', accountName: 'Sari', label: null },
        'trickle-token',
      ),
    )
    expect(await screen.findByText('Sari · •••• 5678')).toBeTruthy()
    expect(screen.queryByDisplayValue('0012 3456-78')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tambah rekening' }))
    expect(
      (within(dialog('Tambah rekening')).getByLabelText('Nomor rekening') as HTMLInputElement)
        .value,
    ).toBe('')
    expect(setItem.mock.calls.some((call) => String(call[1]).includes('0012345678'))).toBe(false)
    setItem.mockRestore()
  })

  it('discards a typed number when the sheet is closed without saving', async () => {
    const sheet = await openAdd()
    fill(sheet, { 'Nomor rekening': '9876543210' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Tutup' }))
    await waitFor(() => expect(screen.queryByDisplayValue('9876543210')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Tambah rekening' }))
    expect(
      (within(dialog('Tambah rekening')).getByLabelText('Nomor rekening') as HTMLInputElement)
        .value,
    ).toBe('')
  })

  it('validates locally without sending a request', async () => {
    const sheet = await openAdd()
    fill(sheet, { 'Nomor rekening': '12345', 'Nama pemilik rekening': 'S' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan rekening' }))
    expect(within(sheet).getByText('Pilih bank.')).toBeTruthy()
    expect(within(sheet).getByText('Nomor rekening harus 6–20 digit.')).toBeTruthy()
    expect(within(sheet).getByText('Nama pemilik harus 2–100 karakter.')).toBeTruthy()
    expect(deps.create).not.toHaveBeenCalled()
  })

  it.each([
    [409, 'BANK_ACCOUNT_EXISTS', 'Rekening sudah ditambahkan'],
    [409, 'BANK_ACCOUNT_LIMIT', 'Batas rekening tercapai'],
    [503, 'BANK_ACCOUNTS_UNAVAILABLE', 'Rekening bank belum tersedia'],
    [403, 'FORBIDDEN', 'Akun belum dapat mengelola rekening'],
    [429, 'RATE_LIMITED', 'Terlalu banyak permintaan'],
    [401, 'UNAUTHORIZED', 'Sesi perlu diperbarui'],
  ])('shows %i %s without replaying the create', async (status, code, title) => {
    deps.create.mockRejectedValue(new ApiError('server', 'raw', { status, code }))
    const sheet = await openAdd()
    fireEvent.change(within(sheet).getByLabelText('Bank'), { target: { value: 'BCA' } })
    fill(sheet, { 'Nomor rekening': '1234567890', 'Nama pemilik rekening': 'Sari' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan rekening' }))
    expect(await within(sheet).findByText(title)).toBeTruthy()
    expect(within(sheet).queryByText('raw')).toBeNull()
    expect(deps.create).toHaveBeenCalledOnce()
  })

  it('submits once on a double click', async () => {
    let resolve!: (value: BankAccountDto) => void
    deps.create.mockImplementation(() => new Promise((done) => (resolve = done)))
    const sheet = await openAdd()
    fireEvent.change(within(sheet).getByLabelText('Bank'), { target: { value: 'BCA' } })
    fill(sheet, { 'Nomor rekening': '1234567890', 'Nama pemilik rekening': 'Sari' })
    const save = within(sheet).getByRole('button', { name: 'Simpan rekening' })
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(deps.create).toHaveBeenCalledOnce())
    await act(async () => resolve(account('bank-9', '7890')))
  })

  it('disables adding at 5 accounts', async () => {
    deps.list.mockResolvedValue({
      data: ['1', '2', '3', '4', '5'].map((n) => account(`bank-${n}`, `000${n}`)),
      nextCursor: null,
    })
    render(<Harness />)
    const add = await screen.findByRole('button', { name: 'Tambah rekening' })
    expect(add.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Maksimal 5 rekening. Hapus salah satu untuk menambah.')).toBeTruthy()
  })

  it('edits only name and label, sending null for an empty label', async () => {
    deps.list.mockResolvedValue({
      data: [account('bank-1', '0123', { label: 'Lama' })],
      nextCursor: null,
    })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah rekening BCA 0123' }))
    const sheet = dialog('Ubah rekening')
    expect(within(sheet).queryByLabelText('Nomor rekening')).toBeNull()
    expect(within(sheet).queryByLabelText('Bank')).toBeNull()
    fill(sheet, { 'Nama pemilik rekening': 'Sari W', 'Label (opsional)': '' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan rekening' }))
    await waitFor(() =>
      expect(deps.update).toHaveBeenCalledWith(
        'bank-1',
        { accountName: 'Sari W', label: null },
        'trickle-token',
      ),
    )
    expect(await screen.findByText('Sari W · •••• 0123')).toBeTruthy()
  })

  it('removes a row the server no longer has while editing', async () => {
    deps.update.mockRejectedValue(new ApiError('not-found', 'x', { status: 404 }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ubah rekening BCA 0123' }))
    const sheet = dialog('Ubah rekening')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Simpan rekening' }))
    expect(await within(sheet).findByText('Rekening tidak ditemukan')).toBeTruthy()
    expect(screen.queryByRole('listitem')).toBeNull()
  })

  it('deletes only after confirmation', async () => {
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus rekening BCA 0123' }))
    expect(deps.remove).not.toHaveBeenCalled()
    const sheet = dialog('Hapus rekening?')
    expect(within(sheet).getByText(/Riwayat pencairan tetap tersimpan/)).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Hapus rekening' }))
    await waitFor(() => expect(deps.remove).toHaveBeenCalledWith('bank-1', 'trickle-token'))
    expect(await screen.findByText('Belum ada rekening')).toBeTruthy()
  })

  it('keeps the row and explains a failed delete', async () => {
    deps.remove.mockRejectedValue(new ApiError('server', 'x', { status: 500 }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Hapus rekening BCA 0123' }))
    const sheet = dialog('Hapus rekening?')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Hapus rekening' }))
    expect(await within(sheet).findByText('Permintaan belum berhasil')).toBeTruthy()
    expect(screen.getByText('Sari Wulandari · •••• 0123')).toBeTruthy()
  })

  it('does not show another account data after remounting for a new identity', async () => {
    const view = render(<Harness key="a" />)
    await screen.findByText('Sari Wulandari · •••• 0123')
    let resolve!: (value: unknown) => void
    deps.list.mockImplementation(() => new Promise((done) => (resolve = done)))
    view.rerender(<Harness key="b" />)
    expect(screen.queryByText('Sari Wulandari · •••• 0123')).toBeNull()
    await waitFor(() => expect(deps.list).toHaveBeenCalledTimes(2))
    await act(async () =>
      resolve({ data: [account('bank-b', '9999', { accountName: 'Budi' })], nextCursor: null }),
    )
    expect(screen.getByText('Budi · •••• 9999')).toBeTruthy()
  })
})
