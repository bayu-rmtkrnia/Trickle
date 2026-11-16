// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IncomingTransfers } from '@/components/family/incoming-transfers'
import { INCOMING_POLL_MS, useIncomingTransfers } from '@/hooks/use-incoming-transfers'
import type { FxQuoteDto } from '@/lib/api/fx'
import type { IncomingTransferDto } from '@/lib/api/incoming-transfers'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/lib/api/incoming-transfers', async (actual) => ({
  ...(await actual<typeof import('@/lib/api/incoming-transfers')>()),
  listIncomingTransfers: deps.list,
}))

const transfer = (id: string, extra: Partial<IncomingTransferDto> = {}): IncomingTransferDto => ({
  id,
  txHash: `0x${id.padStart(64, '0')}`,
  streamId: '7',
  workerAddress: '0x1234567890abcdef1234567890abcdef12345678',
  amountUnits: '3200000',
  paidAt: '2026-11-15T07:02:00Z',
  sender: { id: 'u-siti', displayName: 'Siti' },
  ...extra,
})
const quote: FxQuoteDto = {
  base: 'USD',
  quote: 'IDR',
  rate: 16500,
  source: 'live',
  rateTime: null,
  fetchedAt: null,
}
let session: SessionContextValue

function Harness({ fx = quote }: { fx?: FxQuoteDto | null }) {
  const incoming = useIncomingTransfers(session)
  return <IncomingTransfers incoming={incoming} fx={{ quote: fx }} />
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
  session = {
    status: 'ready',
    user: null,
    expiresAt: '2099-01-01T00:00:00Z',
    error: null,
    ensureSession: vi.fn(async () => 'trickle-token'),
    refreshMe: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
  }
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('family incoming transfers', () => {
  it('shows each transfer with its sender, USD amount and rupiah estimate', async () => {
    deps.list.mockResolvedValue({
      data: [transfer('2'), transfer('1', { sender: null, amountUnits: '5000000' })],
      nextCursor: null,
    })
    render(<Harness />)
    expect(await screen.findByText('Siti')).toBeTruthy()
    expect(screen.getByText('$3,20')).toBeTruthy()
    expect(screen.getByText('≈ Rp52.800')).toBeTruthy()
    // No Trickle account: a short wallet address instead of a name.
    expect(screen.getByText('0x1234…5678')).toBeTruthy()
    expect(screen.getByText('$5')).toBeTruthy()
    expect(deps.list).toHaveBeenCalledWith('trickle-token', undefined, expect.anything())
    const link = screen.getAllByRole('link')[0]!
    expect(link.getAttribute('href')).toMatch(/\/tx\/0x0+2$/)
  })

  it('leaves out the rupiah estimate while the rate is unknown', async () => {
    deps.list.mockResolvedValue({ data: [transfer('1')], nextCursor: null })
    render(<Harness fx={null} />)
    await screen.findByText('Siti')
    expect(screen.queryByText(/≈ Rp/)).toBeNull()
  })

  it('explains an empty list', async () => {
    deps.list.mockResolvedValue({ data: [], nextCursor: null })
    render(<Harness />)
    expect(await screen.findByText('Belum ada kiriman')).toBeTruthy()
  })

  it('shows an error and loads again on retry', async () => {
    deps.list.mockRejectedValueOnce(new Error('down'))
    deps.list.mockResolvedValueOnce({ data: [transfer('1')], nextCursor: null })
    render(<Harness />)
    expect(await screen.findByText('Belum dapat memuat kiriman')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByText('Siti')).toBeTruthy()
  })

  it('appends the next page', async () => {
    deps.list.mockResolvedValueOnce({ data: [transfer('2')], nextCursor: '2' })
    deps.list.mockResolvedValueOnce({
      data: [transfer('1', { sender: { id: 'u-budi', displayName: 'Budi' } })],
      nextCursor: null,
    })
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Muat kiriman lainnya' }))
    expect(await screen.findByText('Budi')).toBeTruthy()
    expect(screen.getByText('Siti')).toBeTruthy()
    expect(deps.list).toHaveBeenLastCalledWith('trickle-token', '2', expect.anything())
    expect(screen.queryByRole('button', { name: 'Muat kiriman lainnya' })).toBeNull()
  })

  it('adds a new transfer on top when the list refreshes, keeping what is shown', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    deps.list.mockResolvedValueOnce({ data: [transfer('1')], nextCursor: null })
    render(<Harness />)
    await waitFor(() => expect(screen.getByText('Siti')).toBeTruthy())
    deps.list.mockResolvedValueOnce({
      data: [transfer('2', { sender: { id: 'u-budi', displayName: 'Budi' } }), transfer('1')],
      nextCursor: null,
    })
    await act(async () => {
      vi.advanceTimersByTime(INCOMING_POLL_MS)
    })
    await waitFor(() => expect(screen.getByText('Budi')).toBeTruthy())
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    // A failed refresh keeps the list instead of showing an error.
    deps.list.mockRejectedValueOnce(new Error('down'))
    await act(async () => {
      vi.advanceTimersByTime(INCOMING_POLL_MS)
    })
    await waitFor(() => expect(deps.list).toHaveBeenCalledTimes(3))
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByText('Belum dapat memuat kiriman')).toBeNull()
  })
})
