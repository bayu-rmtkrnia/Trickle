import { describe, expect, it, vi } from 'vitest'
import type { DemoStream } from '../src/generated/prisma/client.js'
import type { DemoSigner } from '../src/lib/demo.js'
import type { DemoStreamRepository } from '../src/modules/demo-streams/repository.js'
import { createDemoStreamService } from '../src/modules/demo-streams/service.js'

const env = {
  DEMO_STREAM_AMOUNT_USD: '50',
  DEMO_STREAM_MINUTES: 60,
  DEMO_STREAM_DAILY_LIMIT: 10,
  DEMO_STREAM_IP_DAILY_LIMIT: 2,
}
const user = { id: 'user-1', address: '0x00000000000000000000000000000000000000aa' } as const
const ip = '1.1.1.1'
const log = { error: vi.fn(), warn: vi.fn() }

const row = (over: Partial<DemoStream> = {}): DemoStream => ({
  id: 'demo-1',
  userId: user.id,
  address: user.address,
  amountUnits: '50000000',
  durationSeconds: 3600,
  status: 'PENDING',
  streamId: null,
  txHash: null,
  startsAt: null,
  endsAt: null,
  error: null,
  ip,
  createdAt: new Date('2026-10-12T00:00:00Z'),
  updatedAt: new Date('2026-10-12T00:00:00Z'),
  ...over,
})

function setup(repo: Partial<DemoStreamRepository>, demo: Partial<DemoSigner> = {}) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createDemoStreamService({
    env,
    demo: {
      employerAddress: '0x000000000000000000000000000000000000dEaD',
      getGasBalance: async () => 10n ** 18n,
      createStream: async () => {
        throw new Error('unexpected createStream')
      },
      ...demo,
    },
    repo: {
      findByUser: unexpected,
      countActiveSince: unexpected,
      countActiveFromIpSince: unexpected,
      claim: unexpected,
      markSent: unexpected,
      markFailed: unexpected,
      ...repo,
    } as DemoStreamRepository,
  })
}

/** A repo that lets a new stream through every limit. */
const fresh = {
  findByUser: async () => null,
  countActiveSince: async () => 0,
  countActiveFromIpSince: async () => 0,
}

describe('demo stream service: start', () => {
  it('streams $50 for an hour to the caller and records the on-chain id', async () => {
    const createStream = vi.fn<DemoSigner['createStream']>().mockResolvedValue({
      streamId: 7n,
      txHash: `0x${'ab'.repeat(32)}`,
      start: 1_760_000_000,
      end: 1_760_003_600,
    })
    const markSent = vi.fn(
      async (_id: string, tx: Parameters<DemoStreamRepository['markSent']>[1]) =>
        row({ status: 'SENT', ...tx }),
    )
    const s = setup(
      { ...fresh, claim: async () => ({ status: 'claimed', stream: row() }), markSent },
      { createStream },
    )

    const res = await s.start(user, ip, log)

    expect(createStream).toHaveBeenCalledWith(user.address, 50_000_000n, 3600)
    expect(markSent.mock.calls[0]?.[1]).toMatchObject({
      streamId: '7',
      startsAt: new Date(1_760_000_000_000),
      endsAt: new Date(1_760_003_600_000),
    })
    expect(res).toMatchObject({
      created: true,
      stream: { status: 'SENT', streamId: '7', amountUsd: '50', alreadyStarted: false },
    })
  })

  it('returns the earlier stream without creating another', async () => {
    const createStream = vi.fn()
    const s = setup(
      { findByUser: async () => row({ status: 'SENT', streamId: '3' }) },
      { createStream },
    )
    await expect(s.start(user, ip, log)).resolves.toMatchObject({
      created: false,
      stream: { streamId: '3', alreadyStarted: true },
    })
    expect(createStream).not.toHaveBeenCalled()
  })

  it('answers 503 when judge mode is not configured', async () => {
    const s = setup({ findByUser: async () => null }, { employerAddress: undefined })
    await expect(s.start(user, ip, log)).rejects.toMatchObject({
      statusCode: 503,
      code: 'DEMO_UNAVAILABLE',
    })
  })

  it('answers 429 once the daily cap is reached', async () => {
    const s = setup({ ...fresh, countActiveSince: async () => 10 })
    await expect(s.start(user, ip, log)).rejects.toMatchObject({
      statusCode: 429,
      code: 'DEMO_DAILY_LIMIT',
    })
  })

  it('answers 429 once one IP has started too many', async () => {
    const s = setup({ ...fresh, countActiveFromIpSince: async () => 2 })
    await expect(s.start(user, ip, log)).rejects.toMatchObject({
      statusCode: 429,
      code: 'DEMO_IP_LIMIT',
    })
  })

  it('treats a lost race as the earlier stream', async () => {
    const createStream = vi.fn()
    const s = setup(
      { ...fresh, claim: async () => ({ status: 'taken', stream: row() }) },
      { createStream },
    )
    await expect(s.start(user, ip, log)).resolves.toMatchObject({ created: false })
    expect(createStream).not.toHaveBeenCalled()
  })

  it('marks a failed transaction so the account can retry', async () => {
    const markFailed = vi.fn(async () => undefined)
    const s = setup(
      { ...fresh, claim: async () => ({ status: 'claimed', stream: row() }), markFailed },
      { createStream: async () => Promise.reject(new Error('execution reverted')) },
    )
    await expect(s.start(user, ip, log)).rejects.toMatchObject({
      statusCode: 502,
      code: 'DEMO_STREAM_FAILED',
    })
    expect(markFailed).toHaveBeenCalledWith('demo-1', 'execution reverted')
  })
})

describe('demo stream service: status', () => {
  it('reports gas and usage', async () => {
    const s = setup({ countActiveSince: async () => 4 })
    await expect(s.status(log)).resolves.toEqual({
      configured: true,
      employerAddress: '0x000000000000000000000000000000000000dEaD',
      employerGasMon: '1',
      amountUsd: '50',
      durationSeconds: 3600,
      streamsLast24h: 4,
      dailyLimit: 10,
    })
  })

  it('still answers when the RPC is down', async () => {
    const s = setup(
      { countActiveSince: async () => 0 },
      { getGasBalance: async () => Promise.reject(new Error('rpc down')) },
    )
    await expect(s.status(log)).resolves.toMatchObject({ configured: true, employerGasMon: null })
  })
})
