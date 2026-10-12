// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PayoutHistory } from '@/components/family/payout-history'
import { useFamilyPayouts, type FamilyPayoutsState } from '@/hooks/use-family-payouts'
import { ApiError } from '@/lib/api/errors'
import type { PayoutDto } from '@/lib/api/payouts'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }))
vi.mock('@/lib/api/payouts', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/payouts')>()),
  listPayouts: deps.list,
  getPayout: deps.get,
}))

const hashOf = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
const payout = (id: string, extra: Partial<PayoutDto> = {}): PayoutDto => ({
  id,
  status: 'PROCESSING',
  amountUsd: '12.5',
  amountIdr: 203125,
  fxRate: 16250,
  fxSource: 'live',
  sourceTxHash: hashOf(id.length + id.charCodeAt(id.length - 1)),
  bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '0123' },
  provider: 'mock',
  providerRef: `ref-${id}`,
  testMode: true,
  failureReason: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
  ...extra,
})
let session: SessionContextValue
let exposed: FamilyPayoutsState | null = null
let visibility: DocumentVisibilityState = 'visible'

function Harness() {
  const history = useFamilyPayouts(session)
  useEffect(() => {
    exposed = history
  })
  return <PayoutHistory open onClose={() => {}} history={history} />
}
const sheet = () => screen.getByRole('dialog')

beforeEach(() => {
  vi.clearAllMocks()
  exposed = null
  visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  })
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
  deps.list.mockResolvedValue({
    data: [payout('p1', { status: 'COMPLETED' })],
    nextCursor: null,
  })
  deps.get.mockImplementation(async (id: string) => payout(id))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('family payout history', () => {
  it('shows server rupiah, token string, masked bank, status and test mode', async () => {
    deps.list.mockResolvedValue({
      data: [
        payout('p1', { status: 'COMPLETED' }),
        payout('p2', { status: 'PENDING', amountIdr: null, amountUsd: '3' }),
      ],
      nextCursor: null,
    })
    render(<Harness />)
    expect(await within(sheet()).findByText('Rp203.125')).toBeTruthy()
    expect(within(sheet()).getByText('12,5 mAUSD')).toBeTruthy()
    expect(within(sheet()).getByText('Rupiah menunggu server')).toBeTruthy()
    expect(within(sheet()).getAllByText(/BCA •••• 0123/)).toHaveLength(2)
    expect(within(sheet()).getByText('Selesai')).toBeTruthy()
    expect(within(sheet()).getByText('Menunggu')).toBeTruthy()
    expect(within(sheet()).getAllByText('Mode uji')).toHaveLength(2)
  })

  it('distinguishes an empty history from a failed load', async () => {
    deps.list.mockResolvedValueOnce({ data: [], nextCursor: null })
    const view = render(<Harness />)
    expect(await within(sheet()).findByText('Belum ada pencairan')).toBeTruthy()
    view.unmount()
    deps.list.mockRejectedValueOnce(new ApiError('network', 'offline'))
    render(<Harness />)
    expect(await within(sheet()).findByText('Riwayat belum dapat dimuat')).toBeTruthy()
    expect(within(sheet()).queryByText('Belum ada pencairan')).toBeNull()
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Coba lagi' }))
    expect(await within(sheet()).findByText('Rp203.125')).toBeTruthy()
  })

  it('rejects an unknown status as a load error instead of guessing', async () => {
    const actual = await vi.importActual<typeof import('@/lib/api/payouts')>('@/lib/api/payouts')
    deps.list.mockImplementation((token: string, cursor?: string) =>
      actual.listPayouts(token, cursor, {
        baseUrl: 'http://api.test',
        fetcher: async () =>
          Response.json({ data: [{ ...payout('p1'), status: 'REFUNDED' }], nextCursor: null }),
      }),
    )
    render(<Harness />)
    expect(await within(sheet()).findByText('Riwayat belum dapat dimuat')).toBeTruthy()
    expect(within(sheet()).queryByText('Gagal')).toBeNull()
    expect(within(sheet()).queryByText('Selesai')).toBeNull()
  })

  it('pages with the cursor and drops repeated ids', async () => {
    deps.list
      .mockResolvedValueOnce({ data: [payout('p1', { status: 'COMPLETED' })], nextCursor: 'c2' })
      .mockResolvedValueOnce({
        data: [payout('p1', { status: 'COMPLETED' }), payout('p2', { status: 'FAILED' })],
        nextCursor: null,
      })
    render(<Harness />)
    fireEvent.click(await within(sheet()).findByRole('button', { name: 'Muat riwayat lainnya' }))
    expect(await within(sheet()).findByText('Gagal')).toBeTruthy()
    expect(within(sheet()).getAllByRole('listitem')).toHaveLength(2)
    expect(deps.list).toHaveBeenLastCalledWith('trickle-token', 'c2', expect.anything())
  })

  it('opens a detail view with provider info, hash and the no-refund note', async () => {
    deps.list.mockResolvedValue({
      data: [payout('p1', { status: 'FAILED', failureReason: 'The bank rejected the transfer' })],
      nextCursor: null,
    })
    render(<Harness />)
    fireEvent.click(await within(sheet()).findByRole('button', { name: /Detail pencairan/ }))
    const detail = sheet()
    expect(within(detail).getByText('Detail pencairan')).toBeTruthy()
    expect(within(detail).getByText('mock (Mode uji)')).toBeTruthy()
    expect(within(detail).getByText('ref-p1')).toBeTruthy()
    expect(within(detail).getByText('The bank rejected the transfer')).toBeTruthy()
    expect(within(detail).getByText(/token tidak dikembalikan otomatis/)).toBeTruthy()
    expect(
      within(detail).getByRole('link', { name: 'Lihat transfer token di explorer' }),
    ).toBeTruthy()
    fireEvent.click(within(detail).getByRole('button', { name: 'Kembali ke riwayat' }))
    expect(within(sheet()).getByText('Riwayat pencairan')).toBeTruthy()
  })
})

describe('payout status polling', () => {
  it('polls each active payout every 5 seconds and stops once final', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({
      data: [
        payout('p1'),
        payout('p2', { status: 'PENDING' }),
        payout('p3', { status: 'COMPLETED' }),
      ],
      nextCursor: null,
    })
    deps.get.mockImplementation(async (id: string) => payout(id, { status: 'COMPLETED' }))
    render(<Harness />)
    await within(sheet()).findAllByText('Diproses')
    expect(deps.get).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(deps.get.mock.calls.map(([id]) => id).sort()).toEqual(['p1', 'p2'])
    expect(within(sheet()).getAllByText('Selesai')).toHaveLength(3)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(deps.get).toHaveBeenCalledTimes(2)
  })

  it('keeps the last known status when a poll fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    deps.get.mockRejectedValue(new ApiError('server', 'down', { status: 503 }))
    render(<Harness />)
    await within(sheet()).findByText('Diproses')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(within(sheet()).getByText('Diproses')).toBeTruthy()
    expect(within(sheet()).queryByText('Gagal')).toBeNull()
    expect(within(sheet()).getByText(/Status terbaru belum dapat diperbarui/)).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(deps.get).toHaveBeenCalledTimes(2)
  })

  it('waits for Retry-After before polling again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    deps.get.mockRejectedValueOnce(
      new ApiError('rate-limited', 'slow', { status: 429, retryAfterMs: 12000 }),
    )
    render(<Harness />)
    await within(sheet()).findByText('Diproses')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(deps.get).toHaveBeenCalledOnce()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(deps.get).toHaveBeenCalledOnce()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    expect(deps.get).toHaveBeenCalledTimes(2)
  })

  it('recovers a 401 once, then stops polling on a dead session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    deps.get.mockRejectedValue(new ApiError('unauthorized', 'x', { status: 401 }))
    render(<Harness />)
    await within(sheet()).findByText('Diproses')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(session.refreshMe).toHaveBeenCalledOnce()
    expect(deps.get).toHaveBeenCalledTimes(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(deps.get).toHaveBeenCalledTimes(2)
    expect(within(sheet()).getByText('Diproses')).toBeTruthy()
  })

  it('pauses while the tab is hidden and resumes when it is visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    render(<Harness />)
    await within(sheet()).findByText('Diproses')
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(deps.get).not.toHaveBeenCalled()
    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(deps.get).toHaveBeenCalledOnce()
  })

  it('stops polling after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    const view = render(<Harness />)
    await within(sheet()).findByText('Diproses')
    view.unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
    })
    expect(deps.get).not.toHaveBeenCalled()
  })

  it('tracks a payout registered by the transfer flow and polls it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [], nextCursor: null })
    deps.get.mockImplementation(async (id: string) => payout(id, { status: 'COMPLETED' }))
    render(<Harness />)
    await within(sheet()).findByText('Belum ada pencairan')
    act(() => exposed!.track(payout('new')))
    expect(within(sheet()).getByText('Diproses')).toBeTruthy()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(deps.get).toHaveBeenCalledWith('new', 'trickle-token', expect.anything())
    await waitFor(() => expect(within(sheet()).getByText('Selesai')).toBeTruthy())
  })

  it('ignores a detail response for another payout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    deps.list.mockResolvedValue({ data: [payout('p1')], nextCursor: null })
    deps.get.mockResolvedValue(payout('other', { status: 'COMPLETED' }))
    render(<Harness />)
    await within(sheet()).findByText('Diproses')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(within(sheet()).getByText('Diproses')).toBeTruthy()
    expect(within(sheet()).getAllByRole('listitem')).toHaveLength(1)
  })

  it('starts empty for another account', async () => {
    const view = render(<Harness key="a" />)
    await within(sheet()).findByText('Rp203.125')
    let resolve!: (value: unknown) => void
    deps.list.mockImplementation(() => new Promise((done) => (resolve = done)))
    view.rerender(<Harness key="b" />)
    expect(screen.queryByText('Rp203.125')).toBeNull()
    await waitFor(() => expect(deps.list).toHaveBeenCalledTimes(2))
    await act(async () => resolve({ data: [], nextCursor: null }))
    expect(within(sheet()).getByText('Belum ada pencairan')).toBeTruthy()
  })
})
