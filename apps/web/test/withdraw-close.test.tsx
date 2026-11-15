// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { tricklePayrollAbi } from '../../../packages/shared/abi/TricklePayroll'
import { SalaryCard } from '@/components/worker/salary-card'
import { payrollConfig as config } from '@/lib/chain/config'
const b = BigInt,
  worker = '0x2222222222222222222222222222222222222222',
  other = '0x3333333333333333333333333333333333333333',
  hash = `0x${'a'.repeat(64)}`
const deps = vi.hoisted(() => ({
  account: {} as Record<string, unknown>,
  session: {} as Record<string, unknown>,
  port: {} as Record<string, unknown>,
  success: vi.fn(),
  send: vi.fn(),
  streams: {} as Record<string, unknown>,
}))
vi.mock('@/hooks/use-worker-streams', () => ({ useWorkerStreams: () => deps.streams }))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/chain/withdrawal-port', () => ({ createWithdrawalPort: () => deps.port }))
const receipt = {
  transactionHash: hash,
  blockNumber: config.deploymentBlock + b(2),
  status: 'success',
  logs: [
    {
      address: config.payrollAddress,
      data: encodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }], [b(900), b(100)]),
      topics: encodeEventTopics({
        abi: tricklePayrollAbi,
        eventName: 'Withdrawn',
        args: { streamId: b(1), worker },
      }),
    },
    {
      address: config.payrollAddress,
      data: encodeAbiParameters([{ type: 'uint128' }], [b(100)]),
      topics: encodeEventTopics({
        abi: tricklePayrollAbi,
        eventName: 'SplitPaid',
        args: { streamId: b(1), worker, recipient: other },
      }),
    },
  ],
}
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // jsdom has no Web Locks; a single-holder stand-in keeps the real hook path.
  const held = new Set<string>()
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      async request(
        name: string,
        _options: unknown,
        callback: (lock: { name: string } | null) => Promise<unknown>,
      ) {
        if (held.has(name)) return callback(null)
        held.add(name)
        try {
          return await callback({ name })
        } finally {
          held.delete(name)
        }
      },
    },
  })
  deps.send.mockResolvedValue({ hash })
  deps.account = {
    authenticated: true,
    user: { id: 'privy-1' },
    walletAddress: worker,
    sendTransaction: deps.send,
  }
  deps.session = {
    status: 'ready',
    user: { id: 'user-1', address: worker },
    ensureSession: async () => 'test-session',
  }
  deps.port = {
    chainId: async () => 10143,
    bytecode: async () => '0x1234',
    token: async () => config.tokenAddress,
    decimals: async () => 6,
    block: async () => ({
      number: config.deploymentBlock + b(1),
      timestamp: b(150),
      hash: 'canonical',
    }),
    stream: async () => ({ worker }),
    withdrawable: async () => b(1000),
    nativeBalance: async () => b(100),
    transactionCount: async () => b(0),
    simulate: async () => {},
    gasCost: async () => b(1),
    receipt: async () => receipt,
    transaction: async () => ({
      from: worker,
      to: config.payrollAddress,
      input: `0x2e1a7d4d${'0'.repeat(63)}1`,
      value: b(0),
      nonce: b(0),
    }),
  }
})
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  deps.streams = {
    phase: 'ready',
    snapshot: {
      streams: [
        {
          id: b(1),
          employer: other,
          worker,
          amount: b(1000000),
          withdrawn: b(0),
          refunded: b(0),
          start: b(100),
          end: b(200),
          canceled: false,
        },
      ],
      splits: [],
      walletBalance: b(0),
      blockNumber: b(15),
      blockTimestamp: b(150),
      blockHash: 'hash',
      tokenSymbol: 'mAUSD',
    },
    timestamp: b(150),
    refresh: vi.fn(),
    refreshing: false,
    error: null,
  }
})
afterEach(cleanup)
const openDialog = () => document.querySelector('dialog[open]')
describe('closing the withdrawal result', () => {
  it('does not ask for another transaction when the finished sheet is closed', async () => {
    render(<SalaryCard walletAddress={worker} />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tarik gaji' }).hasAttribute('disabled')).toBe(
        false,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Tarik gaji' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Konfirmasi penarikan' }))
    await waitFor(() => expect(screen.getByText(/berhasil/i)).toBeTruthy())
    expect(deps.send).toHaveBeenCalledOnce()
    expect(openDialog()).not.toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Tutup' }).at(-1)!)
    await waitFor(() => expect(openDialog()).toBeNull())
    await new Promise((r) => setTimeout(r, 50))
    expect(openDialog()).toBeNull()
    expect(deps.send).toHaveBeenCalledOnce()
    expect(screen.queryByText('Konfirmasi penarikan')).toBeNull()
  })
})
