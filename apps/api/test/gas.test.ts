import { describe, expect, it, vi } from 'vitest'
import type { GasDrip } from '../src/generated/prisma/client.js'
import type { Chain } from '../src/lib/chain.js'
import type { GasRepository } from '../src/modules/gas/repository.js'
import { createGasService } from '../src/modules/gas/service.js'

const env = { GAS_DRIP_AMOUNT_MON: '0.05', GAS_DRIP_DAILY_LIMIT: 3 }
const address = '0x00000000000000000000000000000000000000aa' as const
const log = { error: vi.fn(), warn: vi.fn() }

const row = (over: Partial<GasDrip> = {}): GasDrip => ({
  id: 'drip-1',
  address,
  amountWei: '50000000000000000',
  status: 'PENDING',
  txHash: null,
  error: null,
  ip: '127.0.0.1',
  createdAt: new Date('2026-10-03T00:00:00Z'),
  updatedAt: new Date('2026-10-03T00:00:00Z'),
  ...over,
})

function setup(repo: Partial<GasRepository>, chain: Partial<Chain> = {}) {
  const unexpected = () => {
    throw new Error('unexpected repository call')
  }
  return createGasService({
    env,
    chain: {
      treasuryAddress: '0x000000000000000000000000000000000000dEaD',
      getBalance: async () => 10n ** 18n,
      sendNative: async () => '0xabc',
      ...chain,
    },
    repo: {
      findByAddress: unexpected,
      countActiveSince: unexpected,
      claim: unexpected,
      markSent: unexpected,
      markFailed: unexpected,
      ...repo,
    } as GasRepository,
  })
}

describe('gas service: drip', () => {
  it('returns the earlier drip without sending again', async () => {
    const sendNative = vi.fn()
    const s = setup({ findByAddress: async () => row({ status: 'SENT' }) }, { sendNative })
    const res = await s.drip(address, '1.1.1.1', log)
    expect(res).toMatchObject({ created: false, drip: { alreadyDripped: true, amountMon: '0.05' } })
    expect(sendNative).not.toHaveBeenCalled()
  })

  it('answers 503 when no treasury is configured', async () => {
    const s = setup({ findByAddress: async () => null }, { treasuryAddress: undefined })
    await expect(s.drip(address, '1.1.1.1', log)).rejects.toMatchObject({
      statusCode: 503,
      code: 'DRIP_UNAVAILABLE',
    })
  })

  it('answers 429 once the daily cap is reached', async () => {
    const s = setup({ findByAddress: async () => null, countActiveSince: async () => 3 })
    await expect(s.drip(address, '1.1.1.1', log)).rejects.toMatchObject({
      statusCode: 429,
      code: 'DRIP_DAILY_LIMIT',
    })
  })

  it('treats a lost race as an earlier drip', async () => {
    const sendNative = vi.fn()
    const s = setup(
      {
        findByAddress: async () => null,
        countActiveSince: async () => 0,
        claim: async () => ({ status: 'taken', drip: row() }),
      },
      { sendNative },
    )
    await expect(s.drip(address, '1.1.1.1', log)).resolves.toMatchObject({ created: false })
    expect(sendNative).not.toHaveBeenCalled()
  })

  it('sends MON and records the tx hash', async () => {
    const markSent = vi.fn(async (_id: string, txHash: string) => row({ status: 'SENT', txHash }))
    const s = setup({
      findByAddress: async () => row({ status: 'FAILED' }),
      countActiveSince: async () => 0,
      claim: async () => ({ status: 'claimed', drip: row() }),
      markSent,
    })
    const res = await s.drip(address, '1.1.1.1', log)
    expect(res).toMatchObject({ created: true, drip: { status: 'SENT', txHash: '0xabc' } })
    expect(markSent).toHaveBeenCalledWith('drip-1', '0xabc')
  })

  it('marks the drip FAILED and answers 502 when the transfer fails', async () => {
    const markFailed = vi.fn(async () => {})
    const s = setup(
      {
        findByAddress: async () => null,
        countActiveSince: async () => 0,
        claim: async () => ({ status: 'claimed', drip: row() }),
        markFailed,
      },
      {
        sendNative: async () => {
          throw new Error('insufficient funds')
        },
      },
    )
    await expect(s.drip(address, '1.1.1.1', log)).rejects.toMatchObject({
      statusCode: 502,
      code: 'DRIP_FAILED',
    })
    expect(markFailed).toHaveBeenCalledWith('drip-1', 'insufficient funds')
  })
})

describe('gas service: status', () => {
  it('reports how many drips the balance still covers', async () => {
    const s = setup({ countActiveSince: async () => 2 })
    await expect(s.status(log)).resolves.toMatchObject({
      configured: true,
      treasuryBalanceMon: '1',
      dripsLast24h: 2,
      dripsRemainingOnBalance: 20,
    })
  })

  it('still answers when the balance cannot be read', async () => {
    const s = setup(
      { countActiveSince: async () => 0 },
      { getBalance: async () => Promise.reject(new Error('rpc down')) },
    )
    await expect(s.status(log)).resolves.toMatchObject({
      treasuryBalanceMon: null,
      dripsRemainingOnBalance: null,
    })
  })
})
