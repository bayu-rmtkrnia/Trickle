import { describe, expect, it } from 'vitest'
import { createPayout, getPayout, isPayout, listPayouts } from '@/lib/api/payouts'

const base = 'http://api.test/api/v1'
const hash = `0x${'ab'.repeat(32)}`
export const payoutDto = {
  id: 'payout-1',
  status: 'PROCESSING',
  amountUsd: '12.5',
  amountIdr: 203125,
  fxRate: 16250,
  fxSource: 'live',
  sourceTxHash: hash,
  bankAccount: { id: 'bank-1', bankCode: 'BCA', accountNumberLast4: '0123' },
  provider: 'mock',
  providerRef: 'mock-ref-1',
  testMode: true,
  failureReason: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:05Z',
}

function capture(response: () => Response) {
  const requests: Request[] = []
  return {
    requests,
    options: {
      baseUrl: base,
      fetcher: async (url: string | URL | Request, init?: RequestInit) => {
        requests.push(new Request(url, init))
        return response()
      },
    },
  }
}

describe('payout adapter', () => {
  it('registers a transfer hash with the bank account id and a Trickle bearer', async () => {
    const { requests, options } = capture(() => Response.json(payoutDto, { status: 201 }))
    const value = await createPayout({ txHash: hash, bankAccountId: 'bank-1' }, 's', options)
    expect(requests[0]?.url).toBe(`${base}/payouts`)
    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer s')
    expect(await requests[0]?.json()).toEqual({ txHash: hash, bankAccountId: 'bank-1' })
    expect(value).toEqual(payoutDto)
  })

  it('accepts the 200 replay of an already registered hash', async () => {
    const { options } = capture(() => Response.json(payoutDto, { status: 200 }))
    await expect(
      createPayout({ txHash: hash, bankAccountId: 'bank-1' }, 's', options),
    ).resolves.toMatchObject({ id: 'payout-1' })
  })

  it.each([
    [409, 'TX_PENDING'],
    [409, 'PAYOUT_EXISTS'],
    [400, 'TX_NOT_A_PAYOUT'],
    [404, 'BANK_ACCOUNT_NOT_FOUND'],
    [502, 'CHAIN_UNAVAILABLE'],
    [503, 'PAYOUTS_UNAVAILABLE'],
  ])('keeps %i %s for recovery decisions, sending once', async (status, code) => {
    const { requests, options } = capture(() =>
      Response.json({ error: { code, message: 'x' } }, { status }),
    )
    await expect(
      createPayout({ txHash: hash, bankAccountId: 'bank-1' }, 's', options),
    ).rejects.toMatchObject({ status, code })
    expect(requests).toHaveLength(1)
  })

  it('reads detail by encoded id and lists with a cursor', async () => {
    const get = capture(() => Response.json(payoutDto))
    await getPayout('p/1', 's', get.options)
    expect(get.requests[0]?.url).toBe(`${base}/payouts/p%2F1`)
    const list = capture(() => Response.json({ data: [payoutDto], nextCursor: null }))
    await expect(listPayouts('s', 'c 2', list.options)).resolves.toEqual({
      data: [payoutDto],
      nextCursor: null,
    })
    expect(list.requests[0]?.url).toBe(`${base}/payouts?cursor=c+2`)
  })

  it.each([
    { ...payoutDto, testMode: false },
    { ...payoutDto, status: 'REFUNDED' },
    { ...payoutDto, amountUsd: '1e3' },
    { ...payoutDto, amountIdr: 1.5 },
    { ...payoutDto, sourceTxHash: '0x12' },
    { ...payoutDto, bankAccount: { ...payoutDto.bankAccount, accountNumberLast4: '12345678' } },
    { ...payoutDto, fxRate: 0 },
  ])('rejects an invalid payout DTO %#', (bad) => {
    expect(isPayout(bad)).toBe(false)
  })

  it('accepts nullable FX and provider fields', () => {
    expect(
      isPayout({
        ...payoutDto,
        status: 'PENDING',
        amountIdr: null,
        fxRate: null,
        fxSource: null,
        providerRef: null,
      }),
    ).toBe(true)
  })
})
