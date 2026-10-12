// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkerStreams } from '@/hooks/use-worker-streams'
const deps = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/chain/viem-port', () => ({ payrollReader: { readWorkerSnapshot: deps.read } }))
const wallet = '0x2222222222222222222222222222222222222222'
const second = '0x3333333333333333333333333333333333333333'
const snapshot = {
  streams: [],
  split: { recipient: second, bps: 0 },
  walletBalance: BigInt(5),
  blockNumber: BigInt(15),
  blockTimestamp: BigInt(100),
  blockHash: 'hash',
  tokenSymbol: 'MockAUSD',
}
function Harness({ address = wallet }: { address?: string }) {
  const state = useWorkerStreams(address)
  return (
    <div>
      <span>{state.phase}</span>
      <span>{state.snapshot?.walletBalance.toString() ?? 'unknown'}</span>
      <span data-testid="now">{state.timestamp?.toString() ?? 'unknown'}</span>
    </div>
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  deps.read.mockResolvedValue(snapshot)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
describe('account-scoped payroll polling', () => {
  it('ticks locally each second but polls RPC only every 15 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)
    await screen.findByText('ready')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(deps.read).toHaveBeenCalledOnce()
    expect(screen.getByTestId('now').textContent).toBe('105')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(deps.read).toHaveBeenCalledTimes(2)
  })
  it('keeps the authoritative snapshot and freezes estimation after RPC failure', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)
    await screen.findByText('ready')
    deps.read.mockRejectedValue(new Error('offline'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByText('stale')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByTestId('now').textContent).toBe('100')
  })
  it('marks a hung refresh stale at 30 seconds instead of running indefinitely', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)
    await screen.findByText('ready')
    deps.read.mockImplementation(() => new Promise(() => {}))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(35000)
    })
    expect(screen.getByText('stale')).toBeTruthy()
    expect(screen.getByTestId('now').textContent).toBe('100')
    expect(deps.read).toHaveBeenCalledTimes(2)
  })
  it('discards old wallet data synchronously and aborts late responses', async () => {
    let resolve!: (value: unknown) => void
    deps.read.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const view = render(<Harness />)
    await waitFor(() => expect(deps.read).toHaveBeenCalledOnce())
    const signal = deps.read.mock.calls[0]![1] as AbortSignal
    deps.read.mockResolvedValue({ ...snapshot, walletBalance: BigInt(9) })
    view.rerender(<Harness address={second} />)
    expect(screen.queryByText('5')).toBeNull()
    await screen.findByText('9')
    await act(async () => {
      resolve(snapshot)
    })
    expect(signal.aborted).toBe(true)
    expect(screen.queryByText('5')).toBeNull()
  })
  it('shows initial failure without representing it as a zero balance', async () => {
    deps.read.mockRejectedValue(new Error('offline'))
    render(<Harness />)
    await screen.findByText('error')
    expect(screen.getAllByText('unknown').length).toBeGreaterThan(0)
    expect(screen.queryByText('0')).toBeNull()
  })
  it('stops polling while hidden and refreshes when visible again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<Harness />)
    await screen.findByText('ready')
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(deps.read).toHaveBeenCalledOnce()
    visibility.mockReturnValue('visible')
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(deps.read).toHaveBeenCalledTimes(2)
  })
  it('aborts pending work on unmount', async () => {
    deps.read.mockImplementationOnce(() => new Promise(() => {}))
    const view = render(<Harness />)
    await waitFor(() => expect(deps.read).toHaveBeenCalledOnce())
    const signal = deps.read.mock.calls[0]![1] as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
})
