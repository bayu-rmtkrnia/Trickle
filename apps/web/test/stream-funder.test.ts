import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, type Hex } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { mockAusdAbi } from '../../../packages/shared/abi/MockAUSD'
import { tricklePayrollAbi } from '../../../packages/shared/abi/TricklePayroll'
import { payrollConfig as config } from '@/lib/chain/config'
import type { WithdrawalReceipt } from '@/lib/chain/payroll-writer'
import {
  createStreamFunder,
  encodeCall,
  fundingPlan,
  TEST_TOP_UP_UNITS,
  type FundingCall,
  type FundingPort,
} from '@/lib/chain/stream-funder'

const b = BigInt
const employer = '0x1111111111111111111111111111111111111111' as const
const worker = '0x2222222222222222222222222222222222222222' as const
const hash = `0x${'a'.repeat(64)}` as Hex
const create = {
  kind: 'create',
  employer,
  worker,
  units: b(800_000_000),
  start: 0,
  end: 1_800_000_000,
} as const satisfies FundingCall

function createdLog(args: { streamId: bigint; employer: Hex; worker: Hex; amount: bigint }) {
  return {
    address: config.payrollAddress,
    topics: encodeEventTopics({
      abi: tricklePayrollAbi,
      eventName: 'StreamCreated',
      args: { streamId: args.streamId, employer: args.employer, worker: args.worker },
    }) as Hex[],
    data: encodeAbiParameters(
      [{ type: 'uint128' }, { type: 'uint40' }, { type: 'uint40' }],
      [args.amount, 1_799_000_000, 1_800_000_000],
    ),
  }
}

function canceledLog(streamId: bigint, refunded: bigint) {
  return {
    address: config.payrollAddress,
    topics: encodeEventTopics({
      abi: tricklePayrollAbi,
      eventName: 'StreamCanceled',
      args: { streamId },
    }) as Hex[],
    data: encodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }], [b(5), refunded]),
  }
}

function fakePort(overrides: Partial<FundingPort> = {}): FundingPort {
  return {
    chainId: async () => config.chainId,
    bytecode: async () => '0x60',
    block: async () => ({ number: b(100), timestamp: b(1) }) as never,
    token: async () => config.tokenAddress,
    nativeBalance: async () => b(10) ** b(18),
    tokenBalance: async () => b(0),
    allowance: async () => b(0),
    simulate: async () => undefined,
    gasCost: async () => b(1000),
    fundGas: async () => undefined,
    receipt: async () => receipt([]),
    transaction: async () => ({
      from: employer,
      to: config.payrollAddress,
      input: encodeCall(create).data,
      value: b(0),
    }),
    ...overrides,
  }
}

const receipt = (
  logs: WithdrawalReceipt['logs'],
  status: 'success' | 'reverted' = 'success',
): WithdrawalReceipt => ({
  transactionHash: hash,
  blockNumber: b(101),
  status,
  logs,
})

describe('encodeCall', () => {
  it('targets the token for mint and approve, and the payroll contract for streams', () => {
    const mint = encodeCall({ kind: 'mint', employer, units: b(5) })
    expect(mint.to).toBe(config.tokenAddress)
    expect(decodeFunctionData({ abi: mockAusdAbi, data: mint.data })).toMatchObject({
      functionName: 'mint',
      args: [employer, b(5)],
    })

    const approve = encodeCall({ kind: 'approve', employer, units: b(5) })
    expect(approve.to).toBe(config.tokenAddress)
    expect(decodeFunctionData({ abi: mockAusdAbi, data: approve.data })).toMatchObject({
      functionName: 'approve',
      args: [config.payrollAddress, b(5)],
    })

    const stream = encodeCall(create)
    expect(stream.to).toBe(config.payrollAddress)
    expect(decodeFunctionData({ abi: tricklePayrollAbi, data: stream.data })).toMatchObject({
      functionName: 'createStream',
      args: [worker, b(800_000_000), 0, 1_800_000_000],
    })

    expect(
      decodeFunctionData({
        abi: tricklePayrollAbi,
        data: encodeCall({ kind: 'cancel', employer, streamId: b(7) }).data,
      }),
    ).toMatchObject({ functionName: 'cancel', args: [b(7)] })
  })
})

describe('createStreamFunder.prepare', () => {
  it('builds the request from the employer to the right contract', async () => {
    const request = await createStreamFunder(fakePort()).prepare(create)
    expect(request).toEqual({
      from: employer,
      to: config.payrollAddress,
      data: encodeCall(create).data,
      chainId: config.chainId,
      value: b(0),
    })
  })

  it('asks for gas once when the account has none', async () => {
    let balance = b(0)
    const fundGas = vi.fn(async () => {
      balance = b(10) ** b(17)
    })
    const funder = createStreamFunder(fakePort({ nativeBalance: async () => balance, fundGas }))
    await funder.prepare(create)
    await funder.prepare(create)
    expect(fundGas).toHaveBeenCalledTimes(1)
  })

  it('fails clearly when gas is still missing after the drip', async () => {
    const funder = createStreamFunder(fakePort({ nativeBalance: async () => b(0) }))
    await expect(funder.prepare(create)).rejects.toMatchObject({ code: 'GAS_INSUFFICIENT' })
  })

  it('surfaces a contract revert from the simulation instead of sending', async () => {
    const funder = createStreamFunder(
      fakePort({ simulate: async () => Promise.reject(new Error('InvalidTimeRange')) }),
    )
    await expect(funder.prepare(create)).rejects.toThrow('InvalidTimeRange')
  })
})

describe('createStreamFunder.verify', () => {
  it('refuses a different chain or token than the published deployment', async () => {
    await expect(
      createStreamFunder(fakePort({ chainId: async () => 1 })).verify(),
    ).rejects.toMatchObject({ code: 'DEPLOYMENT_MISMATCH' })
    await expect(
      createStreamFunder(
        fakePort({ token: async () => '0x9999999999999999999999999999999999999999' }),
      ).verify(),
    ).rejects.toMatchObject({ code: 'DEPLOYMENT_MISMATCH' })
  })
})

describe('createStreamFunder.confirmCreate', () => {
  it('returns the new stream id from StreamCreated', async () => {
    const port = fakePort({
      receipt: async () =>
        receipt([createdLog({ streamId: b(12), employer, worker, amount: create.units })]),
    })
    await expect(createStreamFunder(port).confirmCreate(create, hash)).resolves.toEqual({
      hash,
      streamId: b(12),
    })
  })

  it('rejects a receipt for another worker or amount', async () => {
    const port = fakePort({
      receipt: async () =>
        receipt([
          createdLog({
            streamId: b(12),
            employer,
            worker: '0x3333333333333333333333333333333333333333',
            amount: create.units,
          }),
        ]),
    })
    await expect(createStreamFunder(port).confirmCreate(create, hash)).rejects.toMatchObject({
      code: 'RECEIPT_UNVERIFIED',
    })
  })

  it('rejects a transaction that is not the one we built', async () => {
    const port = fakePort({
      transaction: async () => ({
        from: employer,
        to: config.payrollAddress,
        input: '0x1234',
        value: b(0),
      }),
    })
    await expect(createStreamFunder(port).confirmCreate(create, hash)).rejects.toMatchObject({
      code: 'TRANSACTION_MISMATCH',
    })
  })

  it('reports a reverted transaction', async () => {
    const port = fakePort({ receipt: async () => receipt([], 'reverted') })
    await expect(createStreamFunder(port).confirmCreate(create, hash)).rejects.toMatchObject({
      code: 'REVERTED',
    })
  })
})

describe('createStreamFunder.confirmCancel', () => {
  it('returns what was refunded to the employer', async () => {
    const cancel = { kind: 'cancel', employer, streamId: b(12) } as const
    const port = fakePort({
      receipt: async () => receipt([canceledLog(b(12), b(400))]),
      transaction: async () => ({
        from: employer,
        to: config.payrollAddress,
        input: encodeCall(cancel).data,
        value: b(0),
      }),
    })
    await expect(createStreamFunder(port).confirmCancel(cancel, hash)).resolves.toEqual({
      hash,
      refunded: b(400),
    })
  })
})

describe('fundingPlan', () => {
  const units = b(280_000_000)

  it('needs only createStream when balance and allowance already cover it', () => {
    expect(fundingPlan(units, units, units, true)).toEqual({ mint: null, approve: null })
  })

  it('in test mode tops up and approves in bulk so later fundings skip both', () => {
    const plan = fundingPlan(units, b(1_000_000), b(0), true)
    expect(plan.mint).toBe(TEST_TOP_UP_UNITS - b(1_000_000))
    expect(plan.approve).toBe(TEST_TOP_UP_UNITS)
    const next = fundingPlan(units, TEST_TOP_UP_UNITS - units, TEST_TOP_UP_UNITS - units, true)
    expect(next).toEqual({ mint: null, approve: null })
  })

  it('mints the full amount when one period is larger than the bulk top-up', () => {
    const big = TEST_TOP_UP_UNITS * b(2)
    expect(fundingPlan(big, b(0), b(0), true)).toEqual({ mint: big, approve: big })
  })

  it('approves the whole balance in test mode when only the allowance is short', () => {
    expect(fundingPlan(units, b(500_000_000), b(0), true)).toEqual({
      mint: null,
      approve: b(500_000_000),
    })
  })

  it('with a real token approves only the funded amount and never mints', () => {
    expect(fundingPlan(units, b(500_000_000), b(0), false)).toEqual({ mint: null, approve: units })
    expect(() => fundingPlan(units, b(0), b(0), false)).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_FUNDS' }),
    )
  })
})
