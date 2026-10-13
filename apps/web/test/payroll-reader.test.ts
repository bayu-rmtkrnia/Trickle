import { describe, expect, it, vi } from 'vitest'
import { createPayrollReader, type ChainPort } from '@/lib/chain/payroll-reader'
import type { PayrollConfig } from '@/lib/chain/config'
const b = BigInt
const worker = '0x2222222222222222222222222222222222222222' as const
const other = '0x3333333333333333333333333333333333333333' as const
const employer = '0x1111111111111111111111111111111111111111' as const
const config: PayrollConfig = {
  chainId: 10143,
  rpcUrl: 'http://test',
  payrollAddress: employer,
  tokenAddress: other,
  deploymentBlock: b(10),
  tokenDecimals: 6,
  isMock: true,
  explorerUrl: 'http://explorer',
}
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
function setup(options: Record<string, number> = {}) {
  const blocks = vi.fn(async (n?: bigint) => ({
    number: n ?? b(15),
    timestamp: b(150),
    hash: `hash-${n ?? 15}`,
  }))
  const log = {
    streamId: b(1),
    worker,
    blockNumber: b(10),
    blockHash: 'hash-10',
    transactionHash: 'tx-1',
    logIndex: 0,
  }
  const port: ChainPort = {
    chainId: vi.fn(async () => 10143),
    bytecode: vi.fn(async () => '0x1234'),
    block: blocks,
    token: vi.fn(async () => other),
    decimals: vi.fn(async () => 6),
    symbol: vi.fn(async () => 'MockAUSD'),
    logs: vi.fn(async () => [log, log]),
    stream: vi.fn(async () => stream),
    withdrawable: vi.fn(async () => b(400000)),
    splits: vi.fn(async () => [{ recipient: other, bps: 3000 }]),
    balance: vi.fn(async () => b(250000)),
  }
  const reader = createPayrollReader(() => port, config, {
    rangeSize: b(options.rangeSize ?? 3),
    overlap: b(2),
    maxRanges: options.maxRanges ?? 100,
  })
  return { port, reader, blocks, log }
}
describe('payroll chain snapshot and discovery', () => {
  it('reads backend-indexed stream ids without scanning historical logs', async () => {
    const { port, reader } = setup()
    const result = await reader.readWorkerSnapshotForIds(worker, [b(1)])
    expect(result.streams).toHaveLength(1)
    expect(port.logs).not.toHaveBeenCalled()
    expect(port.stream).toHaveBeenCalledWith(b(1), b(15))
  })
  it('proves an unused deployment is empty without scanning its entire history', async () => {
    const { port, reader } = setup()
    Object.assign(port, { nextStreamId: vi.fn(async () => b(1)) })
    const result = await reader.readWorkerSnapshot(worker)
    expect(result.streams).toEqual([])
    expect(port.logs).not.toHaveBeenCalled()
    expect(port.block).toHaveBeenLastCalledWith(b(15))
  })
  it('validates every log hash when events share a block', async () => {
    const { port, reader, log } = setup()
    vi.mocked(port.logs).mockResolvedValue([
      { ...log, blockHash: 'orphaned-hash' },
      { ...log, logIndex: 1 },
    ])
    await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({ code: 'CHAIN_CHANGED' })
  })
  it('rejects creation logs from an orphaned block before advancing the checkpoint', async () => {
    const { port, reader, log } = setup()
    vi.mocked(port.logs).mockResolvedValue([{ ...log, blockHash: 'orphaned-hash' }])
    await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({ code: 'CHAIN_CHANGED' })
    vi.mocked(port.logs).mockClear().mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    expect(port.logs).toHaveBeenNthCalledWith(1, worker, b(10), b(12))
  })
  it('uses bounded inclusive ranges, deduplicates logs and reads a consistent block', async () => {
    const { port, reader } = setup()
    const result = await reader.readWorkerSnapshot(worker)
    expect(result.streams).toHaveLength(1)
    expect(result.blockNumber).toBe(b(15))
    expect(result.walletBalance).toBe(b(250000))
    expect(port.logs).toHaveBeenCalledWith(worker, b(10), b(12))
    expect(port.logs).toHaveBeenCalledWith(worker, b(13), b(15))
    expect(port.stream).toHaveBeenCalledWith(b(1), b(15))
    expect(port.withdrawable).toHaveBeenCalledWith(b(1), b(15))
  })
  it('reads splitsOf at the snapshot block, up to three recipients', async () => {
    const { port, reader } = setup()
    const splits = [
      { recipient: other, bps: 2000 },
      { recipient: employer, bps: 1500 },
      { recipient: '0x4444444444444444444444444444444444444444' as const, bps: 500 },
    ]
    vi.mocked(port.splits).mockResolvedValue(splits)
    const result = await reader.readWorkerSnapshot(worker)
    expect(result.splits).toEqual(splits)
    expect(port.splits).toHaveBeenCalledWith(worker, b(15))
  })
  it.each([
    [
      'more than three recipients',
      ['0x4', '0x5', '0x6', '0x7'].map((p) => ({
        recipient: `${p.padEnd(42, '4')}` as `0x${string}`,
        bps: 100,
      })),
    ],
    [
      'a total above 100%',
      [
        { recipient: other, bps: 6000 },
        { recipient: employer, bps: 5000 },
      ],
    ],
    [
      'a duplicated recipient',
      [
        { recipient: other, bps: 100 },
        { recipient: other, bps: 100 },
      ],
    ],
    ['a zero share', [{ recipient: other, bps: 0 }]],
  ])('rejects a split list with %s', async (_, splits) => {
    const { port, reader } = setup()
    vi.mocked(port.splits).mockResolvedValue(splits)
    await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
      code: 'SNAPSHOT_MISMATCH',
    })
  })
  it('returns a real zero only after complete successful discovery', async () => {
    const { port, reader } = setup()
    vi.mocked(port.logs).mockResolvedValue([])
    const result = await reader.readWorkerSnapshot(worker)
    expect(result.streams).toEqual([])
  })
  it.each(['chain', 'bytecode', 'token', 'decimals'])(
    'rejects deployment mismatch: %s',
    async (kind) => {
      const { port, reader } = setup()
      if (kind === 'chain') vi.mocked(port.chainId).mockResolvedValue(1)
      if (kind === 'bytecode') vi.mocked(port.bytecode).mockResolvedValue('0x')
      if (kind === 'token') vi.mocked(port.token).mockResolvedValue(worker)
      if (kind === 'decimals') vi.mocked(port.decimals).mockResolvedValue(18)
      await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
        code: 'DEPLOYMENT_MISMATCH',
      })
    },
  )
  it('filters foreign event and stream ownership', async () => {
    const { port, reader, log } = setup()
    vi.mocked(port.logs).mockResolvedValue([{ ...log, worker: other }])
    expect((await reader.readWorkerSnapshot(worker)).streams).toEqual([])
    const second = setup()
    vi.mocked(second.port.stream).mockResolvedValue({ ...stream, worker: other })
    await expect(second.reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
      code: 'STREAM_OWNERSHIP',
    })
  })
  it('resumes failed discovery from the last successful range, with overlap', async () => {
    const { port, reader, log } = setup()
    vi.mocked(port.logs).mockResolvedValueOnce([log]).mockRejectedValueOnce(new Error('offline'))
    await expect(reader.readWorkerSnapshot(worker)).rejects.toThrow('offline')
    vi.mocked(port.logs).mockClear().mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    expect(port.logs).toHaveBeenNthCalledWith(1, worker, b(11), b(13))
  })
  it('keeps wallet discovery caches separate', async () => {
    const { port, reader } = setup()
    vi.mocked(port.logs).mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    vi.mocked(port.logs).mockClear()
    await reader.readWorkerSnapshot(other)
    expect(port.logs).toHaveBeenNthCalledWith(1, other, b(10), b(12))
  })
  it('replaces overlap events and removes orphaned stream ids', async () => {
    const { port, reader, log } = setup()
    vi.mocked(port.logs).mockResolvedValue([{ ...log, blockNumber: b(14), blockHash: 'hash-14' }])
    expect((await reader.readWorkerSnapshot(worker)).streams).toHaveLength(1)
    vi.mocked(port.logs).mockResolvedValue([])
    expect((await reader.readWorkerSnapshot(worker)).streams).toHaveLength(0)
  })
  it('restarts discovery if the checkpoint block is reorganized', async () => {
    const { port, reader, blocks } = setup()
    await reader.readWorkerSnapshot(worker)
    blocks.mockImplementation(async (n?: bigint) => ({
      number: n ?? b(15),
      timestamp: b(150),
      hash: `new-${n ?? 15}`,
    }))
    vi.mocked(port.logs).mockClear().mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    expect(port.logs).toHaveBeenNthCalledWith(1, worker, b(10), b(12))
  })
  it('detects snapshot reorganization and math disagreement with the contract', async () => {
    const { port, reader } = setup()
    vi.mocked(port.withdrawable).mockResolvedValue(b(1))
    await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
      code: 'SNAPSHOT_MISMATCH',
    })
    const second = setup()
    second.blocks.mockImplementation(async (n?: bigint) => ({
      number: n ?? b(15),
      timestamp: b(150),
      hash: n === undefined ? 'old' : 'new',
    }))
    await expect(second.reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
      code: 'CHAIN_CHANGED',
    })
  })
  it('adapts rejected log ranges but does not repeatedly retry network failures', async () => {
    const { port, reader } = setup()
    vi.mocked(port.logs)
      .mockRejectedValueOnce(new Error('block range too large'))
      .mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    expect(port.logs).toHaveBeenNthCalledWith(2, worker, b(10), b(10))
  })
  it('understands the actual Monad public RPC range limit', async () => {
    const { port, reader } = setup({ rangeSize: 10000 })
    vi.mocked(port.logs)
      .mockRejectedValueOnce(new Error('eth_getLogs is limited to a 100 range'))
      .mockResolvedValue([])
    await reader.readWorkerSnapshot(worker)
    expect(port.logs).toHaveBeenCalledTimes(2)
  })
  it('never returns incomplete discovery as an empty snapshot', async () => {
    const { reader } = setup({ maxRanges: 1 })
    await expect(reader.readWorkerSnapshot(worker)).rejects.toMatchObject({
      code: 'SCAN_INCOMPLETE',
    })
  })
  it('honors abort before starting RPC work', async () => {
    const { port, reader } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(reader.readWorkerSnapshot(worker, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(port.chainId).not.toHaveBeenCalled()
  })
})
