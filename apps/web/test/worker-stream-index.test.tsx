// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkerStreams } from '@/hooks/use-worker-streams'
import type { SessionContextValue } from '@/providers/session-provider'

const deps = vi.hoisted(() => ({
  history: vi.fn(),
  indexed: vi.fn(),
  ids: vi.fn(),
}))

vi.mock('@/lib/chain/viem-port', () => ({
  payrollReader: {
    readWorkerSnapshot: deps.history,
    readWorkerSnapshotForIds: deps.indexed,
  },
}))
vi.mock('@/lib/api/streams', () => ({ listAllMyStreamIds: deps.ids }))

const worker = '0x2222222222222222222222222222222222222222'
const snapshot = {
  streams: [],
  splits: [],
  walletBalance: BigInt(5),
  blockNumber: BigInt(15),
  blockTimestamp: BigInt(100),
  blockHash: 'hash',
  tokenSymbol: 'MockAUSD',
}
const session = {
  ensureSession: vi.fn(async () => 'trickle-token'),
  refreshMe: vi.fn(async () => null),
} as unknown as SessionContextValue

function Harness() {
  const state = useWorkerStreams(worker, session)
  return (
    <div>
      <span>{state.phase}</span>
      <span>{state.snapshot?.walletBalance.toString() ?? 'unknown'}</span>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  deps.history.mockRejectedValue(new Error('HTTP 413: eth_getLogs is limited to a 100 range'))
  deps.ids.mockResolvedValue([BigInt(7)])
  deps.indexed.mockResolvedValue(snapshot)
})
afterEach(cleanup)

describe('indexed worker stream discovery', () => {
  it('renders a chain snapshot from backend stream ids without historical log discovery', async () => {
    render(<Harness />)
    await screen.findByText('ready')
    expect(screen.getByText('5')).toBeTruthy()
    expect(deps.history).not.toHaveBeenCalled()
    expect(deps.indexed).toHaveBeenCalledWith(worker, [BigInt(7)], expect.any(AbortSignal))
  })
})
