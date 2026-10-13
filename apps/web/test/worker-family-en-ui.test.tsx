// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BankAccountSheet } from '@/components/family/bank-account-sheet'
import { PayoutDetails } from '@/components/family/payout-status'
import { WithdrawSheet } from '@/components/worker/withdraw-sheet'

vi.mock('@/lib/i18n/client', () => ({
  useDict: <T,>(dictionary: { en: T }) => dictionary.en,
  useLocale: () => ({ locale: 'en', setLocale: vi.fn() }),
}))

beforeEach(() => {
  window.history.replaceState(null, '')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)

describe('English worker and family forms', () => {
  it('shows withdrawal controls and token amount in English format', () => {
    const b = BigInt
    render(
      <WithdrawSheet
        open
        onClose={vi.fn()}
        state={{
          phase: 'confirming',
          streamId: b(1),
          hash: null,
          result: null,
          error: null,
          checking: false,
        }}
        streams={[
          {
            id: b(1),
            employer: '0x1111111111111111111111111111111111111111',
            worker: '0x2222222222222222222222222222222222222222',
            amount: b(1000000),
            withdrawn: b(0),
            refunded: b(0),
            start: b(100),
            end: b(200),
            canceled: false,
          },
        ]}
        timestamp={b(150)}
        splits={[]}
        tokenSymbol="mAUSD"
        select={vi.fn()}
        submit={vi.fn()}
        resume={vi.fn()}
        abandon={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Confirm withdrawal' })).toBeTruthy()
    expect(screen.getAllByText('0.5 mAUSD').length).toBeGreaterThan(0)
  })

  it('shows bank-account labels and validation in English', () => {
    render(
      <BankAccountSheet
        open
        account={null}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onGone={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Add bank account' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save bank account' })).toBeTruthy()
    expect(screen.getByLabelText('Account number')).toBeTruthy()
  })

  it('shows payout details and rupiah amount in English format', () => {
    render(
      <PayoutDetails
        payout={{
          id: 'payout-1',
          status: 'COMPLETED',
          amountUsd: '12.5',
          amountIdr: 125000,
          fxRate: 10000,
          fxSource: 'fallback',
          sourceTxHash: `0x${'a'.repeat(64)}`,
          bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '1234' },
          provider: 'mock',
          providerRef: null,
          testMode: true,
          failureReason: null,
          createdAt: '2026-10-12T10:00:00Z',
          updatedAt: '2026-10-12T10:00:00Z',
        }}
      />,
    )
    expect(screen.getByText('Tokens sent')).toBeTruthy()
    expect(screen.getByText('Received (from server)')).toBeTruthy()
    expect(screen.getByText('Rp125,000')).toBeTruthy()
  })
})
