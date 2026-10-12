import { describe, expect, it, vi } from 'vitest'
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex } from 'viem'
import { tricklePayrollAbi } from '../../../packages/shared/abi/TricklePayroll'
import {
  createPayrollWriter,
  WithdrawalError,
  type WithdrawalPort,
} from '@/lib/chain/payroll-writer'
import { WithdrawalCoordinator, type PendingWithdrawal } from '@/lib/chain/withdrawal-coordinator'
import { payrollConfig as config } from '@/lib/chain/config'
const b = BigInt
const worker = '0x2222222222222222222222222222222222222222' as const
const other = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'a'.repeat(64)}` as const
const calldata = `0x2e1a7d4d${'0'.repeat(63)}1` as const
function withdrawnLog(
  streamId: bigint,
  toWorker: bigint,
  toRecipients: bigint,
  from: Address = worker,
) {
  return {
    address: config.payrollAddress,
    data: encodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }], [toWorker, toRecipients]),
    topics: encodeEventTopics({
      abi: tricklePayrollAbi,
      eventName: 'Withdrawn',
      args: { streamId, worker: from },
    }) as Hex[],
  }
}
function splitPaidLog(
  streamId: bigint,
  recipient: Address,
  amount: bigint,
  from: Address = worker,
) {
  return {
    address: config.payrollAddress,
    data: encodeAbiParameters([{ type: 'uint128' }], [amount]),
    topics: encodeEventTopics({
      abi: tricklePayrollAbi,
      eventName: 'SplitPaid',
      args: { streamId, worker: from, recipient },
    }) as Hex[],
  }
}
function fixture() {
  const port: WithdrawalPort = {
    chainId: async () => config.chainId,
    bytecode: async () => '0x1234',
    block: async () => ({
      number: config.deploymentBlock + b(1),
      timestamp: b(150),
      hash: 'canonical',
    }),
    token: async () => config.tokenAddress,
    decimals: async () => 6,
    symbol: async () => 'mAUSD',
    logs: async () => [],
    stream: async () => ({
      id: b(1),
      worker,
      employer: other,
      start: b(100),
      end: b(200),
      amount: b(2000),
      withdrawn: b(0),
      refunded: b(0),
      canceled: false,
    }),
    withdrawable: async () => b(1000),
    splits: async () => [{ recipient: other, bps: 1000 }],
    balance: async () => b(0),
    nativeBalance: vi.fn(async () => b(100)),
    gasCost: vi.fn(async () => b(10)),
    simulate: vi.fn(async () => {}),
    fundGas: vi.fn(async () => {}),
    receipt: vi.fn(async () => ({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success' as const,
      logs: [withdrawnLog(b(1), b(900), b(100)), splitPaidLog(b(1), other, b(100))],
    })),
    transaction: vi.fn(async () => ({
      from: worker,
      to: config.payrollAddress,
      input: calldata,
      value: b(0),
      nonce: b(7),
    })),
  }
  return { port, writer: createPayrollWriter(port) }
}
describe('payroll withdrawal preparation and settlement', () => {
  it('funds a partially funded wallet when the RPC refuses to estimate gas for insufficient funds', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.nativeBalance).mockResolvedValueOnce(b(1)).mockResolvedValue(b(100))
    vi.mocked(port.gasCost)
      .mockRejectedValueOnce({ name: 'InsufficientFundsError' })
      .mockResolvedValue(b(10))
    await writer.prepare(worker, b(1))
    expect(port.fundGas).toHaveBeenCalledOnce()
  })
  it('encodes the selected stream, simulates from its owner and uses the configured chain', async () => {
    const { port, writer } = fixture()
    const request = await writer.prepare(worker, b(1))
    expect(request).toEqual({
      from: worker,
      to: config.payrollAddress,
      data: calldata,
      chainId: 10143,
      value: b(0),
    })
    expect(port.simulate).toHaveBeenCalledWith(worker, b(1))
  })
  it('blocks an unrelated signer before simulation or gas funding', async () => {
    const { port, writer } = fixture()
    await expect(writer.prepare(other, b(1))).rejects.toMatchObject({ code: 'NOT_WORKER' })
    expect(port.simulate).not.toHaveBeenCalled()
    expect(port.fundGas).not.toHaveBeenCalled()
  })
  it('blocks NothingToWithdraw before signing', async () => {
    const { port, writer } = fixture()
    port.withdrawable = async () => b(0)
    await expect(writer.prepare(worker, b(1))).rejects.toMatchObject({
      code: 'NOTHING_TO_WITHDRAW',
    })
    expect(port.simulate).not.toHaveBeenCalled()
  })
  it.each(['chain', 'token', 'decimals', 'bytecode'])(
    'blocks a mismatched deployment: %s',
    async (kind) => {
      const { port, writer } = fixture()
      if (kind === 'chain') port.chainId = async () => 1
      if (kind === 'token') port.token = async () => other
      if (kind === 'decimals') port.decimals = async () => 18
      if (kind === 'bytecode') port.bytecode = async () => '0x'
      await expect(writer.prepare(worker, b(1))).rejects.toMatchObject({
        code: 'DEPLOYMENT_MISMATCH',
      })
    },
  )
  it('funds gas once when needed and checks the actual resulting balance', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.nativeBalance).mockResolvedValueOnce(b(0)).mockResolvedValue(b(100))
    await writer.prepare(worker, b(1))
    expect(port.fundGas).toHaveBeenCalledOnce()
    const second = fixture()
    vi.mocked(second.port.nativeBalance).mockResolvedValue(b(0))
    await expect(second.writer.prepare(worker, b(1))).rejects.toMatchObject({
      code: 'GAS_INSUFFICIENT',
    })
    expect(second.port.fundGas).toHaveBeenCalledOnce()
  })
  it('does not treat a successful simulation as a confirmed withdrawal', async () => {
    const { writer } = fixture()
    const result = await writer.settle(worker, b(1), hash)
    expect(result).toEqual({
      hash,
      streamId: b(1),
      toWorker: b(900),
      toRecipients: b(100),
      paid: [{ recipient: other, amount: b(100) }],
    })
  })
  it('collects every SplitPaid for up to three recipients in log order', async () => {
    const { port, writer } = fixture()
    const third = '0x4444444444444444444444444444444444444444' as const
    const fourth = '0x5555555555555555555555555555555555555555' as const
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success',
      logs: [
        splitPaidLog(b(1), other, b(50)),
        splitPaidLog(b(1), third, b(30)),
        splitPaidLog(b(1), fourth, b(20)),
        withdrawnLog(b(1), b(900), b(100)),
      ],
    })
    await expect(writer.settle(worker, b(1), hash)).resolves.toEqual({
      hash,
      streamId: b(1),
      toWorker: b(900),
      toRecipients: b(100),
      paid: [
        { recipient: other, amount: b(50) },
        { recipient: third, amount: b(30) },
        { recipient: fourth, amount: b(20) },
      ],
    })
  })
  it('settles a withdrawal without split as an empty payment list', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success',
      logs: [withdrawnLog(b(1), b(1000), b(0))],
    })
    await expect(writer.settle(worker, b(1), hash)).resolves.toMatchObject({
      toWorker: b(1000),
      toRecipients: b(0),
      paid: [],
    })
  })
  it('ignores SplitPaid from another stream or worker', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success',
      logs: [
        splitPaidLog(b(2), other, b(100)),
        splitPaidLog(b(1), other, b(100), other),
        splitPaidLog(b(1), other, b(100)),
        withdrawnLog(b(1), b(900), b(100)),
      ],
    })
    const result = await writer.settle(worker, b(1), hash)
    expect(result.paid).toEqual([{ recipient: other, amount: b(100) }])
  })
  it.each([
    ['payments below toRecipients', [splitPaidLog(b(1), other, b(60))]],
    [
      'payments above toRecipients',
      [splitPaidLog(b(1), other, b(60)), splitPaidLog(b(1), other, b(60))],
    ],
  ])('rejects a receipt whose %s', async (_, payments) => {
    const { port, writer } = fixture()
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success',
      logs: [...payments, withdrawnLog(b(1), b(900), b(100))],
    })
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'RECEIPT_UNVERIFIED',
    })
  })
  it('rejects a receipt with two Withdrawn events for the stream', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'success',
      logs: [withdrawnLog(b(1), b(900), b(0)), withdrawnLog(b(1), b(900), b(0))],
    })
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'RECEIPT_UNVERIFIED',
    })
  })
  it('rejects reverted receipts and unrelated replacement transactions', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.receipt).mockResolvedValue({
      transactionHash: hash,
      blockNumber: config.deploymentBlock + b(2),
      status: 'reverted',
      logs: [],
    })
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({ code: 'REVERTED' })
    const second = fixture()
    const receipt = await second.port.receipt(hash)
    Object.assign(receipt, { replacement: 'cancelled' })
    vi.mocked(second.port.receipt).mockResolvedValue(receipt)
    vi.mocked(second.port.transaction).mockResolvedValue({
      from: worker,
      to: other,
      input: '0x',
      value: b(0),
    })
    await expect(second.writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'REPLACED',
    })
  })
  it('requires the correct contract, worker and stream in the actual receipt event', async () => {
    const { port, writer } = fixture()
    const receipt = await port.receipt(hash)
    receipt.logs[0]!.address = other
    vi.mocked(port.receipt).mockResolvedValue(receipt)
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'RECEIPT_UNVERIFIED',
    })
  })
})
function coordinatorFixture() {
  const { writer } = fixture()
  let pending: PendingWithdrawal | null = null
  let current = true
  const store = {
    read: () => pending,
    write: (p: PendingWithdrawal | null) => {
      pending = p
    },
  }
  const send = vi.fn(async () => ({ hash }))
  const onSuccess = vi.fn()
  const coordinator = new WithdrawalCoordinator({
    worker,
    writer,
    send,
    store,
    isCurrent: () => current,
    onSuccess,
    submissionNonce: async () => b(7),
  })
  return {
    coordinator,
    writer,
    send,
    onSuccess,
    store,
    switchAccount: () => {
      current = false
    },
  }
}
describe('withdrawal transaction lifecycle', () => {
  it('preserves the known submission hash when a manually entered candidate cannot be verified', async () => {
    const { coordinator, writer, store } = coordinatorFixture()
    writer.settle = async () => {
      throw Error('RPC unavailable')
    }
    coordinator.select(b(1))
    await coordinator.submit()
    await coordinator.resume(`0x${'b'.repeat(64)}`)
    expect(store.read()?.hash).toBe(hash)
  })
  it('allows a new confirmation after a definite wallet mismatch before submission', async () => {
    const { coordinator, send, store } = coordinatorFixture()
    send.mockRejectedValue(new WithdrawalError('WALLET_CHANGED'))
    coordinator.select(b(1))
    await coordinator.submit()
    expect(coordinator.getSnapshot().phase).toBe('failed')
    expect(store.read()).toBeNull()
  })
  it('does not unlock another submission when a manually supplied recovery hash belongs to a different transaction', async () => {
    const { coordinator, writer, send, store } = coordinatorFixture()
    send.mockRejectedValue(Error('lost response'))
    coordinator.select(b(1))
    await coordinator.submit()
    writer.settle = async () => {
      throw new Error('not the original transaction')
    }
    await coordinator.resume(hash)
    expect(coordinator.getSnapshot().phase).toBe('unknown')
    expect(store.read()).not.toBeNull()
  })
  it('requires explicit confirmation and suppresses duplicate submissions', async () => {
    const { coordinator, send } = coordinatorFixture()
    await coordinator.submit()
    expect(send).not.toHaveBeenCalled()
    coordinator.select(b(1))
    await Promise.all([coordinator.submit(), coordinator.submit()])
    expect(send).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot().phase).toBe('success')
  })
  it('shows pending until receipt, then exposes actual amounts and refreshes the authoritative balance', async () => {
    const { coordinator, writer, onSuccess, store } = coordinatorFixture()
    let resolve!: (v: Awaited<ReturnType<typeof writer.settle>>) => void
    writer.settle = () =>
      new Promise((r) => {
        resolve = r
      })
    coordinator.select(b(1))
    const done = coordinator.submit()
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('pending'))
    expect(store.read()?.hash).toBe(hash)
    expect(onSuccess).not.toHaveBeenCalled()
    resolve({
      hash,
      streamId: b(1),
      toWorker: b(900),
      toRecipients: b(100),
      paid: [{ recipient: other, amount: b(100) }],
    })
    await done
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(store.read()).toBeNull()
  })
  it('retains ambiguous receipt failures and rechecks without sending another transaction', async () => {
    const { coordinator, writer, send, store } = coordinatorFixture()
    const settle = writer.settle
    writer.settle = async () => {
      throw Error('RPC timeout')
    }
    coordinator.select(b(1))
    await coordinator.submit()
    expect(coordinator.getSnapshot().phase).toBe('unknown')
    expect(store.read()?.hash).toBe(hash)
    writer.settle = settle
    await coordinator.resume()
    expect(send).toHaveBeenCalledOnce()
    expect(coordinator.getSnapshot().phase).toBe('success')
  })
  it('distinguishes user cancellation from ambiguous submission failure', async () => {
    const rejected = coordinatorFixture()
    rejected.send.mockRejectedValue({ code: 4001 })
    rejected.coordinator.select(b(1))
    await rejected.coordinator.submit()
    expect(rejected.coordinator.getSnapshot().phase).toBe('failed')
    expect(rejected.store.read()).toBeNull()
    const unknown = coordinatorFixture()
    unknown.send.mockRejectedValue(Error('connection lost'))
    unknown.coordinator.select(b(1))
    await unknown.coordinator.submit()
    expect(unknown.coordinator.getSnapshot().phase).toBe('unknown')
    expect(unknown.store.read()?.hash).toBeNull()
    await unknown.coordinator.submit()
    expect(unknown.send).toHaveBeenCalledOnce()
  })
  it('recovers a stored pending transaction after reload without asking for another signature', async () => {
    const { writer, send, store } = coordinatorFixture()
    store.write({ streamId: '1', hash, nonce: '7' })
    const fresh = new WithdrawalCoordinator({
      worker,
      writer,
      send,
      store,
      isCurrent: () => true,
      onSuccess: vi.fn(),
    })
    await fresh.resume()
    expect(send).not.toHaveBeenCalled()
    expect(fresh.getSnapshot().phase).toBe('success')
  })
  it('does not apply a late receipt to another account', async () => {
    const { coordinator, writer, onSuccess, switchAccount } = coordinatorFixture()
    let resolve!: (v: Awaited<ReturnType<typeof writer.settle>>) => void
    writer.settle = () =>
      new Promise((r) => {
        resolve = r
      })
    coordinator.select(b(1))
    const done = coordinator.submit()
    await vi.waitFor(() => expect(coordinator.getSnapshot().phase).toBe('pending'))
    switchAccount()
    resolve({
      hash,
      streamId: b(1),
      toWorker: b(900),
      toRecipients: b(100),
      paid: [{ recipient: other, amount: b(100) }],
    })
    await done
    expect(onSuccess).not.toHaveBeenCalled()
  })
  it('stops before signature when gas preparation fails or identity changes', async () => {
    const { coordinator, writer, send } = coordinatorFixture()
    writer.prepare = async () => {
      throw Error('gas unavailable')
    }
    coordinator.select(b(1))
    await coordinator.submit()
    expect(send).not.toHaveBeenCalled()
    expect(coordinator.getSnapshot().phase).toBe('failed')
    const second = coordinatorFixture()
    second.coordinator.select(b(1))
    second.switchAccount()
    await second.coordinator.submit()
    expect(second.send).not.toHaveBeenCalled()
  })
})
describe('manual receipt identity verification', () => {
  it('only releases an interrupted approval when the chain advanced and wallet nonce stayed unused', async () => {
    const { port, writer } = fixture()
    port.transactionCount = vi.fn(async () => BigInt(7))
    expect(await writer.canAbandon(worker, BigInt(7), config.deploymentBlock)).toBe(false)
    port.block = async () => ({
      number: config.deploymentBlock + BigInt(3),
      timestamp: BigInt(150),
      hash: 'canonical',
    })
    expect(await writer.canAbandon(worker, BigInt(7), config.deploymentBlock)).toBe(true)
    port.transactionCount = vi.fn(async (_address, tag) =>
      tag === 'pending' ? BigInt(8) : BigInt(7),
    )
    expect(await writer.canAbandon(worker, BigInt(7), config.deploymentBlock)).toBe(false)
  })
  it('verifies the network again before recovering a pending receipt', async () => {
    const { port, writer } = fixture()
    port.chainId = async () => 1
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'DEPLOYMENT_MISMATCH',
    })
    expect(port.receipt).not.toHaveBeenCalled()
  })
  it('rejects an old withdrawal receipt supplied as recovery for a new request', async () => {
    const { writer } = fixture()
    await expect(
      writer.settle(worker, b(1), hash, config.deploymentBlock + b(3)),
    ).rejects.toMatchObject({ code: 'TRANSACTION_MISMATCH' })
  })
  it('rejects a recovery hash whose transaction used another nonce', async () => {
    const { port, writer } = fixture()
    const tx = await port.transaction(hash)
    vi.mocked(port.transaction).mockResolvedValue({ ...tx, nonce: b(8) })
    await expect(writer.settle(worker, b(1), hash, undefined, b(7))).rejects.toMatchObject({
      code: 'TRANSACTION_MISMATCH',
    })
    vi.mocked(port.transaction).mockResolvedValue({ ...tx, nonce: b(7) })
    await expect(writer.settle(worker, b(1), hash, undefined, b(7))).resolves.toMatchObject({
      toWorker: b(900),
    })
    vi.mocked(port.transaction).mockResolvedValue({ ...tx, nonce: undefined })
    await expect(writer.settle(worker, b(1), hash, undefined, b(7))).rejects.toMatchObject({
      code: 'TRANSACTION_MISMATCH',
    })
  })
  it('treats an unrelated transaction as unverifiable rather than a cancellation of the original request', async () => {
    const { port, writer } = fixture()
    vi.mocked(port.transaction).mockResolvedValue({
      from: worker,
      to: other,
      input: '0x',
      value: b(0),
    })
    await expect(writer.settle(worker, b(1), hash)).rejects.toMatchObject({
      code: 'TRANSACTION_MISMATCH',
    })
  })
})
