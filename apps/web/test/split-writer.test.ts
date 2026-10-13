import { encodeAbiParameters, encodeEventTopics, type Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { tricklePayrollAbi } from '../../../packages/shared/abi/TricklePayroll'
import { payrollConfig as config } from '@/lib/chain/config'
import type { WithdrawalReceipt } from '@/lib/chain/payroll-writer'
import { createSplitWriter, setSplitsData, type SplitPort } from '@/lib/chain/split-writer'
import type { Split } from '@/lib/chain/split'
import { buildSplitDraft } from '@/lib/split-form'

const b = BigInt
const worker = '0x2222222222222222222222222222222222222222' as const
const a = '0x3333333333333333333333333333333333333333' as const
const c = '0x4444444444444444444444444444444444444444' as const
const hash = `0x${'a'.repeat(64)}` as Hex

function updatedLog(splits: readonly Split[], who: `0x${string}` = worker) {
  return {
    address: config.payrollAddress,
    topics: encodeEventTopics({
      abi: tricklePayrollAbi,
      eventName: 'SplitUpdated',
      args: { worker: who },
    }) as Hex[],
    data: encodeAbiParameters(
      [
        {
          type: 'tuple[]',
          components: [
            { name: 'recipient', type: 'address' },
            { name: 'bps', type: 'uint16' },
          ],
        },
      ],
      [splits.map(({ recipient, bps }) => ({ recipient, bps }))],
    ),
  }
}
function setup(splits: readonly Split[], overrides: Partial<SplitPort> = {}) {
  const receipt: WithdrawalReceipt = {
    transactionHash: hash,
    blockNumber: config.deploymentBlock + b(2),
    status: 'success',
    logs: [updatedLog(splits)],
  }
  const port: SplitPort = {
    chainId: async () => config.chainId,
    bytecode: async () => '0x1234',
    block: async () => ({ number: config.deploymentBlock + b(1), timestamp: b(1), hash: 'h' }),
    token: async () => config.tokenAddress,
    decimals: async () => config.tokenDecimals,
    nativeBalance: vi.fn(async () => b(10) ** b(18)),
    simulateSetSplits: vi.fn(async () => {}),
    setSplitsGasCost: vi.fn(async () => b(10)),
    fundGas: vi.fn(async () => {}),
    receipt: vi.fn(async () => receipt),
    transaction: vi.fn(async () => ({
      from: worker,
      to: config.payrollAddress,
      input: setSplitsData(splits),
      value: b(0),
    })),
    ...overrides,
  }
  return { port, writer: createSplitWriter(port) }
}

describe('split form validation', () => {
  it('builds the exact setSplits list from percentages', () => {
    expect(
      buildSplitDraft([
        { recipient: a, percent: '12,5' },
        { recipient: c, percent: '7.25' },
      ]),
    ).toEqual({
      ok: true,
      splits: [
        { recipient: a, bps: 1250 },
        { recipient: c, bps: 725 },
      ],
      totalBps: 1975,
    })
  })

  it('accepts no rows as turning the split off', () => {
    expect(buildSplitDraft([])).toEqual({ ok: true, splits: [], totalBps: 0 })
  })

  it.each([
    ['a missing recipient', [{ recipient: '', percent: '10' }], ['recipient'], null],
    ['a zero percent', [{ recipient: a, percent: '0' }], ['percent'], null],
    ['a malformed percent', [{ recipient: a, percent: '1,234' }], ['percent'], null],
    [
      'a duplicated recipient',
      [
        { recipient: a, percent: '10' },
        { recipient: a.toUpperCase().replace('0X', '0x') as `0x${string}`, percent: '10' },
      ],
      [null, 'DUPLICATE_RECIPIENT'],
      null,
    ],
    [
      'a total above 100%',
      [
        { recipient: a, percent: '60' },
        { recipient: c, percent: '50' },
      ],
      [null, null],
      'TOTAL_OVER_100',
    ],
    ['the worker as recipient', [{ recipient: worker, percent: '10' }], ['recipient'], null],
  ] as const)('rejects %s', (_, rows, rowErrors, general) => {
    const draft = buildSplitDraft(rows as never, worker)
    expect(draft.ok).toBe(false)
    if (!draft.ok) {
      expect(draft.rows).toEqual(rowErrors)
      expect(draft.general).toBe(general)
    }
  })

  it('rejects more than three recipients', () => {
    const rows = ['3', '4', '5', '6'].map((d) => ({
      recipient: `0x${d.repeat(40)}` as `0x${string}`,
      percent: '1',
    }))
    expect(buildSplitDraft(rows)).toMatchObject({ ok: false, general: 'TOO_MANY_RECIPIENTS' })
  })
})

describe('setSplits writer', () => {
  it('encodes setSplits with the typed ABI and simulates from the worker', async () => {
    const splits = [{ recipient: a, bps: 2000 }]
    const { port, writer } = setup(splits)
    await expect(writer.prepare(worker, splits)).resolves.toEqual({
      from: worker,
      to: config.payrollAddress,
      data: setSplitsData(splits),
      chainId: config.chainId,
      value: b(0),
    })
    expect(port.simulateSetSplits).toHaveBeenCalledWith(worker, splits)
  })

  it('accepts an empty list to turn the split off', async () => {
    const { writer } = setup([])
    const request = await writer.prepare(worker, [])
    expect(request.data).toBe(setSplitsData([]))
    await expect(writer.settle(worker, [], hash)).resolves.toEqual({ hash, splits: [] })
  })

  it.each([
    [
      'too many recipients',
      ['3', '4', '5', '6'].map((d) => ({
        recipient: `0x${d.repeat(40)}` as `0x${string}`,
        bps: 100,
      })),
    ],
    [
      'a total above 100%',
      [
        { recipient: a, bps: 6000 },
        { recipient: c, bps: 5000 },
      ],
    ],
    ['the worker as recipient', [{ recipient: worker, bps: 100 }]],
  ])('refuses %s before any RPC call', async (_, splits) => {
    const { port, writer } = setup(splits)
    await expect(writer.prepare(worker, splits)).rejects.toMatchObject({ code: 'INVALID_SPLIT' })
    expect(port.simulateSetSplits).not.toHaveBeenCalled()
  })

  it('funds gas when the wallet has none', async () => {
    const nativeBalance = vi
      .fn<SplitPort['nativeBalance']>()
      .mockResolvedValueOnce(b(0))
      .mockResolvedValue(b(10) ** b(18))
    const { port, writer } = setup([], { nativeBalance })
    await writer.prepare(worker, [])
    expect(port.fundGas).toHaveBeenCalledOnce()
  })

  it('settles only a SplitUpdated with exactly the requested list', async () => {
    const splits = [
      { recipient: a, bps: 2000 },
      { recipient: c, bps: 500 },
    ]
    const { writer } = setup(splits)
    await expect(writer.settle(worker, splits, hash)).resolves.toEqual({ hash, splits })
  })

  it.each<[string, readonly Split[], Partial<SplitPort>, string]>([
    [
      'a different list in the event',
      [{ recipient: a, bps: 2000 }],
      {
        receipt: vi.fn(async () => ({
          transactionHash: hash,
          blockNumber: b(1),
          status: 'success' as const,
          logs: [updatedLog([{ recipient: a, bps: 1999 }])],
        })),
      },
      'RECEIPT_UNVERIFIED',
    ],
    [
      'an event for another worker',
      [{ recipient: a, bps: 2000 }],
      {
        receipt: vi.fn(async () => ({
          transactionHash: hash,
          blockNumber: b(1),
          status: 'success' as const,
          logs: [updatedLog([{ recipient: a, bps: 2000 }], c)],
        })),
      },
      'RECEIPT_UNVERIFIED',
    ],
    [
      'a reverted receipt',
      [],
      {
        receipt: vi.fn(async () => ({
          transactionHash: hash,
          blockNumber: b(1),
          status: 'reverted' as const,
          logs: [],
        })),
      },
      'REVERTED',
    ],
    [
      'another transaction',
      [],
      {
        transaction: vi.fn(async () => ({ from: worker, to: a, input: '0x' as Hex, value: b(0) })),
      },
      'TRANSACTION_MISMATCH',
    ],
  ])('rejects %s', async (_, splits, overrides, code) => {
    const { writer } = setup(splits, overrides)
    await expect(writer.settle(worker, splits, hash)).rejects.toMatchObject({ code })
  })
})
