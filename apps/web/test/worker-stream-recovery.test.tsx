// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWorkerStreams } from '@/hooks/use-worker-streams'
const deps = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/chain/viem-port', () => ({ payrollReader: { readWorkerSnapshot: deps.read } }))
const snapshot = {
  streams: [],
  splits: [],
  walletBalance: BigInt(0),
  blockNumber: BigInt(100),
  blockTimestamp: BigInt(100),
  blockHash: 'unchanged-block',
  tokenSymbol: 'mAUSD',
}
const worker = '0x2222222222222222222222222222222222222222'
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] })
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  deps.read.mockResolvedValue(snapshot)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
it('marks an unchanged chain head stale after 45 seconds of successful polls', async () => {
  const { result } = renderHook(() => useWorkerStreams(worker))
  await act(async () => {
    await Promise.resolve()
  })
  expect(result.current.phase).toBe('ready')
  await act(async () => {
    await vi.advanceTimersByTimeAsync(45000)
  })
  expect(deps.read).toHaveBeenCalledTimes(10)
  expect(result.current.phase).toBe('stale')
})
it('queues an explicit post-settlement refresh while an older snapshot is in flight', async () => {
  let resolve!: (value: typeof snapshot) => void
  deps.read.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const { result } = renderHook(() => useWorkerStreams(worker))
  await act(async () => {
    await Promise.resolve()
  })
  expect(deps.read).toHaveBeenCalledTimes(1)
  act(() => result.current.refresh())
  await act(async () => {
    resolve(snapshot)
    await Promise.resolve()
  })
  expect(deps.read).toHaveBeenCalledTimes(2)
})
