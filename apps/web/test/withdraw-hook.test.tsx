// @vitest-environment jsdom
import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { tricklePayrollAbi } from '../../../packages/shared/abi/TricklePayroll'
import { useWithdrawal } from '@/hooks/use-withdrawal'
import { pendingWithdrawalStore } from '@/lib/chain/withdraw-storage'
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
}))
vi.mock('@/lib/account', () => ({ useAccount: () => deps.account }))
vi.mock('@/providers/session-provider', () => ({ useSession: () => deps.session }))
vi.mock('@/lib/chain/withdrawal-port', () => ({ createWithdrawalPort: () => deps.port }))
function Harness({ address = worker, onSigning }: { address?: string; onSigning?: () => void }) {
  const value = useWithdrawal(address, deps.success, onSigning)
  return (
    <>
      <span>{value.state.phase}</span>
      <button disabled={!value.ready} onClick={() => value.select(b(1))}>
        Pilih
      </button>
      <button onClick={value.submit}>Kirim</button>
    </>
  )
}
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
afterEach(cleanup)
describe('withdrawal hook account lifecycle', () => {
  it('hands off the modal before invoking the wallet signature prompt', async () => {
    let sheetClosed = false
    deps.send.mockImplementation(async () => {
      if (!sheetClosed) throw Error('Wallet prompt blocked by native sheet')
      return { hash }
    })
    render(
      <Harness
        onSigning={() => {
          sheetClosed = true
        }}
      />,
    )
    await waitFor(() => expect(screen.getByText('Pilih').hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByText('Pilih'))
    fireEvent.click(screen.getByText('Kirim'))
    await screen.findByText('success')
  })
  it('can submit after StrictMode effect cleanup without using an aborted preflight signal', async () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    await waitFor(() => expect(screen.getByText('Pilih').hasAttribute('disabled')).toBe(false))
    fireEvent.click(screen.getByText('Pilih'))
    fireEvent.click(screen.getByText('Kirim'))
    await screen.findByText('success')
    expect(deps.send).toHaveBeenCalledOnce()
    expect(deps.success).toHaveBeenCalledOnce()
  })
  it('isolates resumed transactions and late receipts when the wallet changes', async () => {
    pendingWithdrawalStore(worker).write({ streamId: '1', hash: hash as `0x${string}`, nonce: '0' })
    let resolve!: (value: typeof receipt) => void
    deps.port.receipt = () =>
      new Promise((r) => {
        resolve = r
      })
    const view = render(<Harness />)
    await screen.findByText('pending')
    deps.account = { ...deps.account, walletAddress: other, user: { id: 'privy-2' } }
    deps.session = { ...deps.session, user: { id: 'user-2', address: other } }
    view.rerender(<Harness address={other} />)
    expect(screen.getByText('idle')).toBeTruthy()
    resolve(receipt)
    await waitFor(() => expect(pendingWithdrawalStore(worker).read()).toBeNull())
    expect(deps.success).not.toHaveBeenCalled()
    expect(deps.send).not.toHaveBeenCalled()
    expect(screen.getByText('idle')).toBeTruthy()
  })
})
