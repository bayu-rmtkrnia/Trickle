// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalaryCard } from '@/components/worker/salary-card'
const deps = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('@/hooks/use-worker-streams', () => ({ useWorkerStreams: () => deps.state }))
const b = BigInt
const worker = '0x2222222222222222222222222222222222222222'
const employer = '0x1111111111111111111111111111111111111111'
const stream = {
  id: b(1),
  employer,
  worker,
  amount: b(1000000),
  withdrawn: b(100000),
  refunded: b(0),
  start: b(100),
  end: b(200),
  canceled: false,
}
const snapshot = {
  streams: [stream],
  split: { recipient: worker, bps: 3000 },
  walletBalance: b(2000000),
  blockNumber: b(15),
  blockTimestamp: b(150),
  blockHash: 'hash',
  tokenSymbol: 'MockAUSD',
}
beforeEach(() => {
  deps.state = {
    phase: 'ready',
    snapshot,
    timestamp: b(150),
    refresh: vi.fn(),
    refreshing: false,
    error: null,
  }
})
afterEach(cleanup)
describe('live salary card', () => {
  it('keeps rounding dust with the worker for each independently withdrawn stream', () => {
    deps.state = {
      ...deps.state,
      snapshot: {
        ...snapshot,
        split: { recipient: worker, bps: 5000 },
        streams: [1, 2].map((id) => ({ ...stream, id: b(id), amount: b(2), withdrawn: b(0) })),
      },
    }
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByText('0,000002 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0 MockAUSD')).toBeTruthy()
  })
  it('separates gross available salary, wallet balance and family split estimates', () => {
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByTestId('available-salary').textContent).toBe('0,4')
    expect(screen.getByText('2 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0,28 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0,12 MockAUSD')).toBeTruthy()
    expect(screen.getByText('Aset demo')).toBeTruthy()
    expect(screen.getByText('Pengirim belum dikenali')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tarik gaji' }).hasAttribute('disabled')).toBe(true)
  })
  it('only matches employer metadata to the actual stream employer address', () => {
    render(
      <SalaryCard
        walletAddress={worker}
        employments={[
          {
            id: 'job',
            displayName: 'Siti',
            monthlySalaryUsd: 800,
            joinedAt: '2026-10-11T00:00:00Z',
            employer: { id: 'co', name: 'PT Maju', country: null, ownerAddress: employer },
          },
        ]}
      />,
    )
    expect(screen.getByText('PT Maju')).toBeTruthy()
    expect(screen.queryByText('Pengirim belum dikenali')).toBeNull()
  })
  it('labels a last-known snapshot stale and keeps its balance visible', () => {
    deps.state = { ...deps.state, phase: 'stale', error: new Error('offline') }
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByText('Data payroll tertunda')).toBeTruthy()
    expect(screen.getByTestId('available-salary').textContent).toBe('0,4')
  })
  it('shows verified empty discovery as no payroll, not a failure', () => {
    deps.state = { ...deps.state, snapshot: { ...snapshot, streams: [] } }
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByText('Belum ada payroll untuk wallet ini')).toBeTruthy()
    expect(screen.getByTestId('available-salary').textContent).toBe('0')
  })
  it('shows RPC failure without fabricating zero', () => {
    deps.state = {
      phase: 'error',
      snapshot: null,
      timestamp: null,
      error: new Error('offline'),
      refresh: vi.fn(),
      refreshing: false,
    }
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByText('Belum dapat membaca payroll')).toBeTruthy()
    expect(screen.queryByTestId('available-salary')).toBeNull()
  })
})
