import { describe, expect, it, vi } from 'vitest'
import { listAllMyStreamIds, listMyStreams } from '@/lib/api/streams'

const stream = {
  id: '7',
  employerAddress: '0x1111111111111111111111111111111111111111',
  workerAddress: '0x2222222222222222222222222222222222222222',
  amountUnits: '1000000',
  withdrawnUnits: '100000',
  refundedUnits: '0',
  startsAt: '2026-10-13T01:00:00.000Z',
  endsAt: '2026-10-13T02:00:00.000Z',
  status: 'ACTIVE',
  syncedAt: '2026-10-13T01:30:00.000Z',
  company: { id: 'company-1', name: 'PT Maju' },
}

describe('worker stream index API', () => {
  it('uses the authenticated worker endpoint with an encoded cursor and cancellation', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ data: [stream], nextCursor: null })),
    )
    const controller = new AbortController()
    await expect(
      listMyStreams('trickle-token', 'a/b&c', {
        baseUrl: 'https://api.test/api/v1',
        fetcher,
        signal: controller.signal,
      }),
    ).resolves.toEqual({ data: [stream], nextCursor: null })
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/api/v1/users/me/streams?cursor=a%2Fb%26c')
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer trickle-token')
    expect(options.signal).toBe(controller.signal)
  })

  it('collects every indexed stream id across pages without duplicates', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [stream], nextCursor: '7' })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { ...stream, id: '6' },
              { ...stream, id: '7' },
            ],
            nextCursor: null,
          }),
        ),
      )
    await expect(
      listAllMyStreamIds('trickle-token', { baseUrl: 'https://api.test/api/v1', fetcher }),
    ).resolves.toEqual([BigInt(7), BigInt(6)])
  })

  it.each([
    null,
    { data: [stream] },
    { data: [{ ...stream, id: '0' }], nextCursor: null },
    { data: [{ ...stream, workerAddress: 'not-an-address' }], nextCursor: null },
    { data: [{ ...stream, amountUnits: '-1' }], nextCursor: null },
    { data: [{ ...stream, status: 'UNKNOWN' }], nextCursor: null },
    { data: [{ ...stream, company: { id: '', name: 'PT Maju' } }], nextCursor: null },
  ])('rejects malformed indexed stream data (%j)', async (value) => {
    await expect(
      listMyStreams('trickle-token', undefined, {
        baseUrl: 'https://api.test/api/v1',
        fetcher: async () => new Response(JSON.stringify(value)),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('rejects a pagination cursor that does not advance', async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ data: [stream], nextCursor: '7' })),
    )
    await expect(
      listAllMyStreamIds('trickle-token', { baseUrl: 'https://api.test/api/v1', fetcher }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
