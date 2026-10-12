// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WithdrawSheet } from '@/components/worker/withdraw-sheet'
const b = BigInt
const state = {
  phase: 'confirming' as const,
  streamId: b(1),
  hash: null,
  result: null,
  error: null,
  checking: false,
}
const stream = {
  id: b(1),
  employer: '0x1111111111111111111111111111111111111111' as const,
  worker: '0x2222222222222222222222222222222222222222' as const,
  amount: b(1000000),
  withdrawn: b(100000),
  refunded: b(0),
  start: b(100),
  end: b(200),
  canceled: false,
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(cleanup)
function props() {
  return {
    open: true,
    onClose: vi.fn(),
    state,
    streams: [stream],
    timestamp: b(150),
    splits: [{ recipient: '0x3333333333333333333333333333333333333333' as const, bps: 3000 }],
    tokenSymbol: 'mAUSD',
    select: vi.fn(),
    submit: vi.fn(),
    resume: vi.fn(),
    abandon: vi.fn(),
  }
}
describe('withdrawal sheet', () => {
  it('shows estimates and requires an explicit confirmation before signing', () => {
    const p = props()
    render(<WithdrawSheet {...p} />)
    expect(p.submit).not.toHaveBeenCalled()
    expect(screen.getByText('0,28 mAUSD')).toBeTruthy()
    // One recipient: the family total and that recipient's share are the same amount.
    expect(screen.getAllByText('0,12 mAUSD')).toHaveLength(2)
    expect(screen.getByText('Penerima 1 (0x3333…3333)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Konfirmasi penarikan' }))
    expect(p.submit).toHaveBeenCalledOnce()
  })
  it('blocks confirmation when the source balance is stale', () => {
    const p = props()
    render(<WithdrawSheet {...p} timestamp={null} />)
    expect(
      screen.getByRole('button', { name: 'Konfirmasi penarikan' }).hasAttribute('disabled'),
    ).toBe(true)
  })
  it('shows actual event amounts after success rather than the old estimate', () => {
    const p = props()
    render(
      <WithdrawSheet
        {...p}
        state={{
          ...state,
          phase: 'success',
          hash: `0x${'a'.repeat(64)}`,
          result: {
            hash: `0x${'a'.repeat(64)}`,
            streamId: b(1),
            toWorker: b(350000),
            toRecipients: b(150000),
            paid: [
              { recipient: '0x3333333333333333333333333333333333333333', amount: b(100000) },
              { recipient: '0x4444444444444444444444444444444444444444', amount: b(50000) },
            ],
          },
        }}
      />,
    )
    expect(screen.getByText('0,35 mAUSD')).toBeTruthy()
    expect(screen.getByText('0,15 mAUSD')).toBeTruthy()
    expect(screen.getByText('Penerima 1 (0x3333…3333)')).toBeTruthy()
    expect(screen.getByText('0,1 mAUSD')).toBeTruthy()
    expect(screen.getByText('Penerima 2 (0x4444…4444)')).toBeTruthy()
    expect(screen.getByText('0,05 mAUSD')).toBeTruthy()
    expect(screen.queryByText('0,28 mAUSD')).toBeNull()
  })
  it('previews every recipient before confirmation', () => {
    const p = props()
    render(
      <WithdrawSheet
        {...p}
        splits={[
          { recipient: '0x3333333333333333333333333333333333333333', bps: 2000 },
          { recipient: '0x4444444444444444444444444444444444444444', bps: 1000 },
          { recipient: '0x5555555555555555555555555555555555555555', bps: 500 },
        ]}
      />,
    )
    // 0,4 gross: 0,08 + 0,04 + 0,02 to family, 0,26 to the worker.
    expect(screen.getByText('0,26 mAUSD')).toBeTruthy()
    expect(screen.getByText('0,14 mAUSD')).toBeTruthy()
    expect(screen.getByText('Penerima 3 (0x5555…5555)')).toBeTruthy()
    expect(screen.getByText('0,02 mAUSD')).toBeTruthy()
  })
  it('offers receipt recheck, not another signature, when status is unknown', () => {
    const p = props()
    render(
      <WithdrawSheet {...p} state={{ ...state, phase: 'unknown', hash: `0x${'a'.repeat(64)}` }} />,
    )
    expect(screen.queryByRole('button', { name: 'Konfirmasi penarikan' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Periksa status transaksi' }))
    expect(p.resume).toHaveBeenCalledOnce()
    expect(p.submit).not.toHaveBeenCalled()
  })
  it('offers guarded recovery for an interrupted approval with no hash', () => {
    const p = props()
    render(<WithdrawSheet {...p} state={{ ...state, phase: 'unknown', hash: null }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Periksa permintaan belum dikirim' }))
    expect(p.abandon).toHaveBeenCalledOnce()
    expect(p.submit).not.toHaveBeenCalled()
  })
})
