import { describe, expect, it, vi } from 'vitest'
import { createFxService } from '../src/lib/fx.js'

const ok = (rate: number) =>
  new Response(
    JSON.stringify({
      result: 'success',
      rates: { IDR: rate },
      time_last_update_unix: 1_700_000_000,
    }),
  )

describe('fx service', () => {
  it('fetches live, then serves from cache inside the window', async () => {
    let t = 0
    const fetch = vi.fn().mockResolvedValue(ok(16000))
    const fx = createFxService({
      url: 'x',
      cacheSeconds: 600,
      fallbackRate: 1,
      fetch,
      now: () => t,
    })

    expect(await fx.usdIdr()).toMatchObject({ rate: 16000, source: 'live' })
    t = 599_000
    expect(await fx.usdIdr()).toMatchObject({ rate: 16000, source: 'cache' })
    expect(fetch).toHaveBeenCalledTimes(1)

    t = 601_000
    fetch.mockResolvedValue(ok(16100))
    expect(await fx.usdIdr()).toMatchObject({ rate: 16100, source: 'live' })
  })

  it('serves the last good rate when the provider fails', async () => {
    let t = 0
    const fetch = vi.fn().mockResolvedValueOnce(ok(16000)).mockRejectedValue(new Error('down'))
    const fx = createFxService({ url: 'x', cacheSeconds: 1, fallbackRate: 1, fetch, now: () => t })

    await fx.usdIdr()
    t = 10_000
    expect(await fx.usdIdr()).toMatchObject({ rate: 16000, source: 'cache' })
  })

  it('uses the static fallback when nothing was ever fetched', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }))
    const fx = createFxService({ url: 'x', cacheSeconds: 1, fallbackRate: 16500, fetch })

    expect(await fx.usdIdr()).toEqual({
      base: 'USD',
      quote: 'IDR',
      rate: 16500,
      source: 'fallback',
      rateTime: null,
      fetchedAt: null,
    })
  })
})
