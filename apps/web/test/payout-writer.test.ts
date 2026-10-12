import { encodeAbiParameters, encodeEventTopics, erc20Abi, zeroAddress, type Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import type { PayrollConfig } from '@/lib/chain/config'
import { resolvePayoutAddress } from '@/lib/chain/payout-config'
import {
  createPayoutWriter,
  transferData,
  type PayoutPort,
  type PayoutReceipt,
} from '@/lib/chain/payout-writer'
import { parseTokenAmount } from '@/lib/family-money'

const b = BigInt
const wallet = '0x2222222222222222222222222222222222222222' as const
const destination = '0x4444444444444444444444444444444444444444' as const
const payroll = '0x1111111111111111111111111111111111111111' as const
const token = '0x3333333333333333333333333333333333333333' as const
const hash = `0x${'ab'.repeat(32)}` as Hex
const config: PayrollConfig = {
  chainId: 10143,
  rpcUrl: 'http://test',
  payrollAddress: payroll,
  tokenAddress: token,
  deploymentBlock: b(10),
  tokenDecimals: 6,
  isMock: true,
  explorerUrl: 'http://explorer',
}

function transferLog(from: string, to: string, value: bigint, address: string = token) {
  return {
    address: address as `0x${string}`,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: 'Transfer',
      args: { from: from as `0x${string}`, to: to as `0x${string}` },
    }) as Hex[],
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  }
}
function receipt(overrides: Partial<PayoutReceipt> = {}): PayoutReceipt {
  return {
    transactionHash: hash,
    blockNumber: b(30),
    status: 'success',
    logs: [transferLog(wallet, destination, b(5_000_000))],
    ...overrides,
  }
}
function setup(overrides: Partial<PayoutPort> = {}) {
  const port: PayoutPort = {
    chainId: vi.fn(async () => 10143),
    bytecode: vi.fn(async () => '0x1234'),
    block: vi.fn(async () => ({ number: b(20), timestamp: b(1), hash: '0xh' })),
    token: vi.fn(async () => token),
    decimals: vi.fn(async () => 6),
    balance: vi.fn(async () => b(12_500_000)),
    transactionCount: vi.fn(async () => b(7)),
    nativeBalance: vi.fn(async () => b(10) ** b(18)),
    simulateTransfer: vi.fn(async () => {}),
    transferGasCost: vi.fn(async () => b(1000)),
    fundGas: vi.fn(async () => {}),
    receipt: vi.fn(async () => receipt()),
    transaction: vi.fn(async () => ({
      from: wallet,
      to: token,
      input: transferData(destination, b(5_000_000)),
      value: b(0),
    })),
    ...overrides,
  }
  return { port, writer: createPayoutWriter(port, config) }
}

describe('payout transfer writer', () => {
  it('builds transfer(payoutAddress, amount) sent to the token contract', async () => {
    const { port, writer } = setup()
    const request = await writer.prepare(wallet, destination, b(5_000_000))
    expect(request).toEqual({
      from: wallet,
      to: token,
      data: transferData(destination, b(5_000_000)),
      chainId: 10143,
      value: b(0),
    })
    expect(request.to).not.toBe(destination)
    expect(port.simulateTransfer).toHaveBeenCalledWith(wallet, destination, b(5_000_000))
  })

  it('refuses an amount above the verified balance', async () => {
    const { port, writer } = setup()
    await expect(writer.prepare(wallet, destination, b(12_500_001))).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })
    expect(port.simulateTransfer).not.toHaveBeenCalled()
  })

  it.each([
    ['zero amount', wallet, destination, b(0)],
    ['negative amount', wallet, destination, b(-1)],
    ['destination is the wallet', wallet, wallet, b(1)],
  ])('rejects %s', async (_, from, to, amount) => {
    const { writer } = setup()
    await expect(writer.prepare(from, to, amount)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  })

  it.each<[string, Partial<PayoutPort>]>([
    ['wrong chain', { chainId: vi.fn(async () => 1) }],
    ['payroll token differs', { token: vi.fn(async () => payroll) }],
    ['decimals differ', { decimals: vi.fn(async () => 18) }],
    ['missing token code', { bytecode: vi.fn(async () => '0x') }],
  ])('rejects %s before signing', async (_, overrides) => {
    const { writer } = setup(overrides)
    await expect(writer.prepare(wallet, destination, b(1))).rejects.toMatchObject({
      code: 'DEPLOYMENT_MISMATCH',
    })
  })

  it('requests gas when the wallet has none, then re-reads the MON balance', async () => {
    const nativeBalance = vi
      .fn<PayoutPort['nativeBalance']>()
      .mockResolvedValueOnce(b(0))
      .mockResolvedValue(b(10) ** b(18))
    const { port, writer } = setup({ nativeBalance })
    await writer.prepare(wallet, destination, b(1))
    expect(port.fundGas).toHaveBeenCalledOnce()
    expect(nativeBalance).toHaveBeenCalledTimes(2)
  })

  it('stops when gas is still missing after funding', async () => {
    const { writer } = setup({ nativeBalance: vi.fn(async () => b(0)) })
    await expect(writer.prepare(wallet, destination, b(1))).rejects.toMatchObject({
      code: 'GAS_INSUFFICIENT',
    })
  })

  it('settles only the exact Transfer from the wallet to the destination', async () => {
    const { writer } = setup()
    await expect(writer.settle(wallet, destination, b(5_000_000), hash, b(20))).resolves.toEqual({
      hash,
      amount: b(5_000_000),
      blockNumber: b(30),
    })
  })

  it.each<[string, Partial<PayoutPort>, string]>([
    [
      'a reverted receipt',
      { receipt: vi.fn(async () => receipt({ status: 'reverted' })) },
      'REVERTED',
    ],
    [
      'a replaced transaction',
      {
        receipt: vi.fn(async () => receipt({ replacement: 'replaced' })),
        transaction: vi.fn(async () => ({
          from: wallet,
          to: token,
          input: '0x' as Hex,
          value: b(0),
        })),
      },
      'REPLACED',
    ],
    [
      'a transaction to another contract',
      {
        transaction: vi.fn(async () => ({
          from: wallet,
          to: payroll,
          input: transferData(destination, b(5_000_000)),
          value: b(0),
        })),
      },
      'TRANSACTION_MISMATCH',
    ],
    [
      'a different amount in the event',
      { receipt: vi.fn(async () => receipt({ logs: [transferLog(wallet, destination, b(1))] })) },
      'RECEIPT_UNVERIFIED',
    ],
    [
      'an event from another token',
      {
        receipt: vi.fn(async () =>
          receipt({ logs: [transferLog(wallet, destination, b(5_000_000), payroll)] }),
        ),
      },
      'RECEIPT_UNVERIFIED',
    ],
    [
      'two matching events',
      {
        receipt: vi.fn(async () =>
          receipt({
            logs: [
              transferLog(wallet, destination, b(5_000_000)),
              transferLog(wallet, destination, b(5_000_000)),
            ],
          }),
        ),
      },
      'RECEIPT_UNVERIFIED',
    ],
    [
      'a receipt mined before the submission block',
      { receipt: vi.fn(async () => receipt({ blockNumber: b(20) })) },
      'TRANSACTION_MISMATCH',
    ],
  ])('rejects %s', async (_, overrides, code) => {
    const { writer } = setup(overrides)
    await expect(
      writer.settle(wallet, destination, b(5_000_000), hash, b(20)),
    ).rejects.toMatchObject({ code })
  })

  it('allows abandoning only when no transaction used the nonce after 2 blocks', async () => {
    const block = vi.fn(async () => ({ number: b(22), timestamp: b(1), hash: '0xh' }))
    const { writer } = setup({ block })
    await expect(writer.canAbandon(wallet, b(7), b(20))).resolves.toBe(true)
    const sent = setup({ block, transactionCount: vi.fn(async () => b(8)) })
    await expect(sent.writer.canAbandon(wallet, b(7), b(20))).resolves.toBe(false)
    const early = setup()
    await expect(early.writer.canAbandon(wallet, b(7), b(20))).resolves.toBe(false)
  })
})

describe('payout configuration and amount parsing', () => {
  it.each([
    [undefined, null],
    ['', null],
    ['not-an-address', null],
    [zeroAddress, null],
    [payroll, null],
    [token, null],
    [` ${destination} `, destination],
  ])('resolves NEXT_PUBLIC_PAYOUT_ADDRESS %j', (raw, expected) => {
    expect(resolvePayoutAddress(raw, config)?.toLowerCase() ?? null).toBe(
      expected?.toLowerCase() ?? null,
    )
  })

  it.each([
    ['12,5', b(12_500_000)],
    ['12.5', b(12_500_000)],
    ['0,000001', b(1)],
    ['1000', b(1_000_000_000)],
  ])('parses %j with bigint units', (raw, units) => {
    expect(parseTokenAmount(raw, 6)).toEqual({ ok: true, units })
  })

  it.each([
    ['', 'empty'],
    ['1e3', 'invalid'],
    ['-1', 'invalid'],
    ['1.000,5', 'invalid'],
    ['0,0000001', 'precision'],
    ['0', 'zero'],
    ['0,000000', 'zero'],
  ])('rejects %j as %s', (raw, reason) => {
    expect(parseTokenAmount(raw, 6)).toEqual({ ok: false, reason })
  })
})
