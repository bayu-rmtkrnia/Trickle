import { expect, it, vi } from 'vitest'
import { createPayrollReader, type ChainPort } from '@/lib/chain/payroll-reader'
import type { PayrollConfig } from '@/lib/chain/config'

it('recovers orphaned discovery state after a reorg between scan ranges', async () => {
  const worker = '0x2222222222222222222222222222222222222222' as const
  const employer = '0x1111111111111111111111111111111111111111' as const
  const token = '0x3333333333333333333333333333333333333333' as const
  const config: PayrollConfig = {
    chainId: 10143,
    rpcUrl: 'http://test',
    payrollAddress: employer,
    tokenAddress: token,
    deploymentBlock: BigInt(1),
    tokenDecimals: 6,
    isMock: true,
    explorerUrl: 'http://explorer',
  }
  let reorganized = false
  const hash = (n: bigint) => `${reorganized && n >= BigInt(70) ? 'new' : 'old'}-${n}`
  const logs = vi.fn(async (_worker: string, from: bigint, to: bigint) => {
    // Range 61..80 has been fully validated and cached when this triggers.
    if (from === BigInt(81)) reorganized = true
    if (!reorganized && from <= BigInt(70) && to >= BigInt(70))
      return [
        {
          streamId: BigInt(1),
          worker,
          blockNumber: BigInt(70),
          blockHash: hash(BigInt(70)),
          transactionHash: 'orphan-tx',
          logIndex: 0,
        },
      ]
    // Canonical replacement created stream 1 for a different worker; this
    // worker has no creations. nextStreamId stays 2, so no empty shortcut.
    return []
  })
  const port: ChainPort = {
    chainId: async () => 10143,
    bytecode: async () => '0x1234',
    block: async (n = BigInt(100)) => ({ number: n, timestamp: BigInt(150), hash: hash(n) }),
    token: async () => token,
    decimals: async () => 6,
    symbol: async () => 'MockAUSD',
    nextStreamId: async () => BigInt(2),
    logs,
    stream: async (id) => ({
      id,
      employer,
      worker: token,
      amount: BigInt(1000),
      withdrawn: BigInt(0),
      refunded: BigInt(0),
      start: BigInt(100),
      end: BigInt(200),
      canceled: false,
    }),
    withdrawable: async () => BigInt(500),
    splits: async () => [],
    balance: async () => BigInt(0),
  }
  const reader = createPayrollReader(() => port, config, {
    rangeSize: BigInt(20),
    overlap: BigInt(12),
  })
  await expect(reader.listWorkerStreamIds(worker)).rejects.toMatchObject({ code: 'CHAIN_CHANGED' })
  logs.mockClear()
  const ids = await reader.listWorkerStreamIds(worker)
  expect(ids).toEqual([])
  expect(logs.mock.calls[0]?.[1]).toBe(BigInt(1))
  const snapshot = await reader.readWorkerSnapshot(worker)
  expect(snapshot.streams).toEqual([])
})
