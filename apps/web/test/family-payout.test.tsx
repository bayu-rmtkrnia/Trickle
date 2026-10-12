// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Hex } from 'viem'
import { PayoutSheet } from '@/components/family/payout-sheet'
import type { FamilyPayout } from '@/hooks/use-family-payout'
import { ApiError } from '@/lib/api/errors'
import type { BankAccountDto } from '@/lib/api/bank-accounts'
import type { PayoutDto } from '@/lib/api/payouts'
import type { FamilyPayoutState } from '@/lib/chain/payout-coordinator'

const b = BigInt
const hash = `0x${'ab'.repeat(32)}` as Hex
const accounts: BankAccountDto[] = [
  {
    id: 'bank-1',
    bankCode: 'BCA',
    accountName: 'Sari',
    label: 'Utama',
    accountNumberLast4: '0123',
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:00:00Z',
  },
  {
    id: 'bank-2',
    bankCode: 'BNI',
    accountName: 'Sari',
    label: null,
    accountNumberLast4: '4567',
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:00:00Z',
  },
]
const quote = {
  base: 'USD' as const,
  quote: 'IDR' as const,
  rate: 16250,
  source: 'live' as const,
  rateTime: null,
  fetchedAt: null,
}
const serverPayout: PayoutDto = {
  id: 'payout-1',
  status: 'FAILED',
  amountUsd: '5',
  amountIdr: 81250,
  fxRate: 16250,
  fxSource: 'live',
  sourceTxHash: hash,
  bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '0123' },
  provider: 'mock',
  providerRef: 'ref-1',
  testMode: true,
  failureReason: 'The bank rejected the transfer',
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
}
const base: FamilyPayoutState = {
  phase: 'confirming',
  amountUnits: null,
  bankAccountId: null,
  hash: null,
  payout: null,
  error: null,
  checking: false,
  unreadable: false,
}

function controller(state: Partial<FamilyPayoutState> = {}, configured = true): FamilyPayout {
  return {
    state: { ...base, ...state },
    ready: true,
    configured,
    destination: configured ? '0x4444444444444444444444444444444444444444' : null,
    start: vi.fn(),
    cancel: vi.fn(),
    submit: vi.fn(),
    resume: vi.fn(),
    retryRegistration: vi.fn(),
    changeBank: vi.fn(),
    abandon: vi.fn(),
    dismiss: vi.fn(),
    discardUnreadable: vi.fn(),
  }
}
function show(payout: FamilyPayout, options: { balance?: bigint | null } = {}) {
  render(
    <PayoutSheet
      open
      onClose={vi.fn()}
      payout={payout}
      accounts={accounts}
      balance={options.balance === undefined ? b(12_500_000) : options.balance}
      tokenSymbol="mAUSD"
      quote={quote}
      walletAddress="0x2222222222222222222222222222222222222222"
    />,
  )
  return screen.getByRole('dialog')
}

beforeEach(() => {
  window.history.replaceState(null, '')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(() => cleanup())

describe('family payout sheet', () => {
  it('submits bigint units and the chosen bank account, labelled as test mode', () => {
    const payout = controller()
    const sheet = show(payout)
    expect(within(sheet).getByText(/bukan transfer bank nyata/)).toBeTruthy()
    fireEvent.click(within(sheet).getByLabelText(/BNI/))
    fireEvent.change(within(sheet).getByLabelText('Jumlah mAUSD'), { target: { value: '5,25' } })
    expect(within(sheet).getByText('≈ Rp85.312')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kirim dan cairkan' }))
    expect(payout.submit).toHaveBeenCalledWith({
      amountUnits: b(5_250_000),
      bankAccountId: 'bank-2',
    })
  })

  it.each([
    ['1e3', 'Gunakan angka, misalnya 12,5.'],
    ['0,0000001', 'Maksimal 6 angka di belakang koma.'],
    ['0', 'Jumlah harus lebih dari 0.'],
    ['12,500001', 'Jumlah melebihi saldo.'],
  ])('rejects amount %j without submitting', (value, message) => {
    const payout = controller()
    const sheet = show(payout)
    fireEvent.click(within(sheet).getByLabelText(/BCA/))
    fireEvent.change(within(sheet).getByLabelText('Jumlah mAUSD'), { target: { value } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kirim dan cairkan' }))
    expect(within(sheet).getByText(message)).toBeTruthy()
    expect(payout.submit).not.toHaveBeenCalled()
  })

  it('requires choosing a bank account when there are several', () => {
    const payout = controller()
    const sheet = show(payout)
    fireEvent.change(within(sheet).getByLabelText('Jumlah mAUSD'), { target: { value: '1' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Kirim dan cairkan' }))
    expect(within(sheet).getByText('Pilih rekening tujuan.')).toBeTruthy()
    expect(payout.submit).not.toHaveBeenCalled()
  })

  it('fills the full balance without rounding', () => {
    const sheet = show(controller(), { balance: b(1_234_567_891) })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Semua' }))
    expect((within(sheet).getByLabelText('Jumlah mAUSD') as HTMLInputElement).value).toBe(
      '1234,567891',
    )
  })

  it('keeps the transfer disabled when the payout address is not configured', () => {
    const sheet = show(controller({}, false))
    expect(within(sheet).getByText('Pencairan belum dikonfigurasi')).toBeTruthy()
    expect(
      within(sheet).getByRole('button', { name: 'Kirim dan cairkan' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('keeps the transfer disabled while the balance is not verified', () => {
    const sheet = show(controller(), { balance: null })
    expect(
      within(sheet).getByRole('button', { name: 'Kirim dan cairkan' }).hasAttribute('disabled'),
    ).toBe(true)
  })

  it('offers re-registration with the same hash and no new transfer', () => {
    const payout = controller({
      phase: 'registration-pending',
      hash,
      amountUnits: b(5_000_000),
      error: new ApiError('server', 'x', { status: 503, code: 'PAYOUTS_UNAVAILABLE' }),
    })
    const sheet = show(payout)
    expect(within(sheet).getByText(hash)).toBeTruthy()
    expect(within(sheet).getByText(/Token aman; daftarkan ulang/)).toBeTruthy()
    expect(within(sheet).queryByRole('button', { name: 'Kirim dan cairkan' })).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Daftarkan ulang pencairan' }))
    expect(payout.retryRegistration).toHaveBeenCalledOnce()
    expect(payout.submit).not.toHaveBeenCalled()
  })

  it('asks for another account when the bank was deleted, only after a choice', () => {
    const payout = controller({
      phase: 'registration-pending',
      hash,
      bankAccountId: 'bank-1',
      error: new ApiError('not-found', 'x', { status: 404, code: 'BANK_ACCOUNT_NOT_FOUND' }),
    })
    const sheet = show(payout)
    const use = within(sheet).getByRole('button', { name: 'Gunakan rekening ini' })
    expect(use.hasAttribute('disabled')).toBe(true)
    expect(within(sheet).queryByLabelText(/BCA/)).toBeNull()
    fireEvent.click(within(sheet).getByLabelText(/BNI/))
    fireEvent.click(use)
    expect(payout.changeBank).toHaveBeenCalledWith('bank-2')
  })

  it('checks an unknown submission by hash and validates a pasted hash', () => {
    const payout = controller({ phase: 'submission-unknown', hash: null })
    const sheet = show(payout)
    const check = within(sheet).getByRole('button', { name: 'Periksa transfer' })
    expect(check.hasAttribute('disabled')).toBe(true)
    const field = within(sheet).getByLabelText('Hash transaksi (opsional)')
    fireEvent.change(field, { target: { value: '0x12' } })
    expect(check.hasAttribute('disabled')).toBe(true)
    fireEvent.change(field, { target: { value: hash } })
    fireEvent.click(check)
    expect(payout.resume).toHaveBeenCalledWith(hash)
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Periksa bahwa transfer belum dikirim' }),
    )
    expect(payout.abandon).toHaveBeenCalledOnce()
  })

  it('says a failed bank payout is not refunded and shows the server amount', () => {
    const payout = controller({ phase: 'payout-failed', hash, payout: serverPayout })
    const sheet = show(payout)
    expect(within(sheet).getByText(/Token tidak dikembalikan otomatis/)).toBeTruthy()
    expect(within(sheet).getByText('Rp81.250')).toBeTruthy()
    expect(within(sheet).getByText('mock (Mode uji)')).toBeTruthy()
    expect(within(sheet).getByText('BCA •••• 0123')).toBeTruthy()
    expect(within(sheet).queryByText(/dikembalikan ke wallet/)).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Selesai' }))
    expect(payout.dismiss).toHaveBeenCalledOnce()
  })

  it('requires the explorer confirmation before discarding an unreadable record', () => {
    const payout = controller({
      phase: 'submission-unknown',
      unreadable: true,
      hash,
      error: Object.assign(new Error('x'), { code: 'STORAGE_UNAVAILABLE' }),
    })
    const sheet = show(payout)
    expect(within(sheet).getByText('Data pemulihan tidak dapat dibaca')).toBeTruthy()
    expect(within(sheet).queryByRole('button', { name: 'Periksa transfer' })).toBeNull()
    expect(within(sheet).queryByLabelText('Hash transaksi (opsional)')).toBeNull()
    expect(within(sheet).getByRole('link', { name: hash }).getAttribute('href')).toContain(hash)
    const discard = within(sheet).getByRole('button', { name: 'Hapus data pemulihan' })
    expect(discard.hasAttribute('disabled')).toBe(true)
    fireEvent.click(within(sheet).getByRole('checkbox'))
    fireEvent.click(discard)
    expect(payout.discardUnreadable).toHaveBeenCalledWith(true)
  })

  it('does not offer the footer close while the wallet signature is pending', () => {
    const sheet = show(controller({ phase: 'signing' }))
    const buttons = within(sheet).getAllByRole('button', { name: 'Tutup' })
    expect(buttons.at(-1)!.hasAttribute('disabled')).toBe(true)
  })
})
