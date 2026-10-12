import { describe, expect, it } from 'vitest'
import { getUsdIdr } from '@/lib/api/fx'

const quote = {
  base: 'USD',
  quote: 'IDR',
  rate: 16250.5,
  source: 'live',
  rateTime: '2026-10-12T10:00:00Z',
  fetchedAt: '2026-10-12T10:01:00Z',
}

describe('USD/IDR adapter', () => {
  it('reads the authenticated endpoint with a Trickle bearer', async () => {
    let request!: Request
    const value = await getUsdIdr('trickle-session', {
      baseUrl: 'http://api.test/api/v1',
      fetcher: async (url, init) => {
        request = new Request(url, init)
        return Response.json(quote)
      },
    })
    expect(request.url).toBe('http://api.test/api/v1/fx-rates/usd-idr')
    expect(request.method).toBe('GET')
    expect(request.headers.get('authorization')).toBe('Bearer trickle-session')
    expect(value).toEqual(quote)
  })

  it('accepts a fallback rate without timestamps', async () => {
    const fallback = { ...quote, source: 'fallback', rateTime: null, fetchedAt: null }
    await expect(
      getUsdIdr('t', { baseUrl: 'http://api.test', fetcher: async () => Response.json(fallback) }),
    ).resolves.toEqual(fallback)
  })

  it.each([
    { ...quote, rate: 0 },
    { ...quote, rate: -1 },
    { ...quote, rate: '16250' },
    { ...quote, source: 'guess' },
    { ...quote, quote: 'MYR' },
    { ...quote, rateTime: 'yesterday' },
    { ...quote, fetchedAt: 123 },
  ])('rejects an invalid quote %#', async (bad) => {
    await expect(
      getUsdIdr('t', { baseUrl: 'http://api.test', fetcher: async () => Response.json(bad) }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('preserves API errors such as 401', async () => {
    await expect(
      getUsdIdr('t', {
        baseUrl: 'http://api.test',
        fetcher: async () =>
          Response.json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, { status: 401 }),
      }),
    ).rejects.toMatchObject({ status: 401 })
  })
})
