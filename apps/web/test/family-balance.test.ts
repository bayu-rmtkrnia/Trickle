import { describe, expect, it, vi } from 'vitest'
import type { PayrollConfig } from '@/lib/chain/config'
import { createFamilyBalanceReader, type FamilyBalancePort } from '@/lib/chain/family-balance'
import { ChainReadError } from '@/lib/chain/types'

const b = BigInt
const wallet = '0x2222222222222222222222222222222222222222'
const payroll = '0x1111111111111111111111111111111111111111' as const
const token = '0x3333333333333333333333333333333333333333' as const
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

function setup(overrides: Partial<FamilyBalancePort> = {}) {
  const port: FamilyBalancePort = {
    chainId: vi.fn(async () => 10143),
    bytecode: vi.fn(async () => '0x1234'),
    block: vi.fn(async (n?: bigint) => ({
      number: n ?? b(20),
      timestamp: b(1000),
      hash: `0xhash${n ?? 20}`,
    })),
    token: vi.fn(async () => token),
    decimals: vi.fn(async () => 6),
    symbol: vi.fn(async () => 'mAUSD'),
    balance: vi.fn(async () => b(12_500_000)),
    ...overrides,
  }
  return { port, read: createFamilyBalanceReader(() => port, config) }
}

describe('family balance reader', () => {
  it('reads balanceOf(wallet) at one verified block', async () => {
    const { port, read } = setup()
    await expect(read(wallet)).resolves.toEqual({
      balance: b(12_500_000),
      blockNumber: b(20),
      blockHash: '0xhash20',
      blockTimestamp: b(1000),
      tokenSymbol: 'mAUSD',
    })
    expect(port.balance).toHaveBeenCalledWith(wallet, b(20))
    expect(port.bytecode).toHaveBeenCalledWith(payroll, b(20))
    expect(port.bytecode).toHaveBeenCalledWith(token, b(20))
  })

  it('returns a verified zero balance instead of failing', async () => {
    const { read } = setup({ balance: vi.fn(async () => b(0)) })
    await expect(read(wallet)).resolves.toMatchObject({ balance: b(0) })
  })

  it.each<[string, Partial<FamilyBalancePort>]>([
    ['wrong chain', { chainId: vi.fn(async () => 1) }],
    ['missing contract code', { bytecode: vi.fn(async () => '0x') }],
    ['payroll token differs from manifest', { token: vi.fn(async () => payroll) }],
    ['token decimals differ', { decimals: vi.fn(async () => 18) }],
    ['empty symbol', { symbol: vi.fn(async () => ' ') }],
    [
      'head before deployment',
      { block: vi.fn(async () => ({ number: b(5), timestamp: b(1), hash: '0x5' })) },
    ],
  ])('rejects %s as a deployment mismatch', async (_, overrides) => {
    const { read } = setup(overrides)
    await expect(read(wallet)).rejects.toMatchObject({ code: 'DEPLOYMENT_MISMATCH' })
  })

  it('rejects a block that was reorganized during the read', async () => {
    const block = vi
      .fn<FamilyBalancePort['block']>()
      .mockResolvedValueOnce({ number: b(20), timestamp: b(1000), hash: '0xold' })
      .mockResolvedValueOnce({ number: b(20), timestamp: b(1000), hash: '0xnew' })
    const { read } = setup({ block })
    await expect(read(wallet)).rejects.toMatchObject({ code: 'CHAIN_CHANGED' })
  })

  it('rejects an invalid wallet before calling RPC', async () => {
    const { port, read } = setup()
    await expect(read('0x1234')).rejects.toBeInstanceOf(ChainReadError)
    expect(port.block).not.toHaveBeenCalled()
  })

  it('propagates RPC failures instead of reporting zero', async () => {
    const { read } = setup({
      balance: vi.fn(async () => {
        throw new Error('rpc down')
      }),
    })
    await expect(read(wallet)).rejects.toThrow('rpc down')
  })

  it('stops when the request is aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const { port, read } = setup()
    await expect(read(wallet, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(port.block).not.toHaveBeenCalled()
  })
})
