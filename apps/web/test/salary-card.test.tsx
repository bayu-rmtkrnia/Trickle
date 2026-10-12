// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SalaryCard } from '@/components/worker/salary-card'
const deps = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
const actions = vi.hoisted(() => ({ select: vi.fn(), submit: vi.fn(), resume: vi.fn() }))
vi.mock('@/hooks/use-worker-streams', () => ({ useWorkerStreams: () => deps.state }))
vi.mock('@/hooks/use-withdrawal', () => ({
  useWithdrawal: () => ({
    ready: true,
    state: {
      phase: 'idle',
      streamId: null,
      hash: null,
      result: null,
      error: null,
      checking: false,
    },
    ...actions,
  }),
}))
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
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
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
  it('opens confirmation for the selected stream without submitting automatically', () => {
    render(<SalaryCard walletAddress={worker} />)
    fireEvent.click(screen.getByRole('button', { name: 'Tarik gaji' }))
    expect(actions.select).toHaveBeenCalledWith(BigInt(1))
    expect(actions.submit).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
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
    fireEvent.click(screen.getByRole('button', { name: 'Info detail' }))
    expect(screen.getByText('0,000002 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0 MockAUSD')).toBeTruthy()
  })
  it('separates gross available salary, wallet balance and family split estimates', () => {
    render(<SalaryCard walletAddress={worker} />)
    expect(screen.getByTestId('available-salary').textContent).toBe('0,4')
    expect(screen.queryByText('2 MockAUSD')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Info detail' }))
    expect(screen.getByText('2 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0,28 MockAUSD')).toBeTruthy()
    expect(screen.getByText('0,12 MockAUSD')).toBeTruthy()
    expect(screen.getByText('Aset demo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tarik gaji' }).hasAttribute('disabled')).toBe(false)
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
    fireEvent.click(screen.getByRole('button', { name: 'Lihat payroll' }))
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
    expect(screen.getByRole('button', { name: 'Tarik gaji' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText('Saldo token di wallet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lihat payroll' }))
    expect(
      screen.getByText(
        'Perusahaan perlu mendanai payroll ke wallet kamu sebelum gaji dapat mengalir.',
      ),
    ).toBeTruthy()
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
