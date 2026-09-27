export type FxSource = 'live' | 'cache' | 'fallback'

export interface FxQuote {
  base: 'USD'
  quote: 'IDR'
  rate: number
  source: FxSource
  /** When the provider last updated the rate (ISO). `null` for the fallback rate. */
  rateTime: string | null
  /** When this server fetched it (ISO). `null` for the fallback rate. */
  fetchedAt: string | null
}

interface Options {
  url: string
  cacheSeconds: number
  fallbackRate: number
  fetch?: typeof fetch
  now?: () => number
}

/**
 * USD→IDR rate for display only. Cached in memory; if the provider is down we
 * serve the last good rate, and only then the static fallback. The response
 * always says which one it is so the UI can label it honestly.
 */
export function createFxService(opts: Options) {
  const doFetch = opts.fetch ?? fetch
  const now = opts.now ?? Date.now
  let cached: { rate: number; rateTime: string | null; fetchedAt: number } | undefined

  async function fetchLive() {
    const res = await doFetch(opts.url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`FX provider responded ${res.status}`)
    const body = (await res.json()) as {
      result?: string
      rates?: Record<string, number>
      time_last_update_unix?: number
    }
    const rate = body.rates?.IDR
    if (body.result !== 'success' || typeof rate !== 'number' || !(rate > 0)) {
      throw new Error('FX provider returned an unexpected payload')
    }
    return {
      rate,
      rateTime: body.time_last_update_unix
        ? new Date(body.time_last_update_unix * 1000).toISOString()
        : null,
    }
  }

  return {
    async usdIdr(): Promise<FxQuote> {
      const t = now()
      if (cached && t - cached.fetchedAt < opts.cacheSeconds * 1000) {
        return quote(cached.rate, 'cache', cached.rateTime, cached.fetchedAt)
      }
      try {
        const live = await fetchLive()
        cached = { ...live, fetchedAt: t }
        return quote(live.rate, 'live', live.rateTime, t)
      } catch {
        if (cached) return quote(cached.rate, 'cache', cached.rateTime, cached.fetchedAt)
        return quote(opts.fallbackRate, 'fallback', null, null)
      }
    },
  }
}

function quote(
  rate: number,
  source: FxSource,
  rateTime: string | null,
  fetchedAt: number | null,
): FxQuote {
  return {
    base: 'USD',
    quote: 'IDR',
    rate,
    source,
    rateTime,
    fetchedAt: fetchedAt === null ? null : new Date(fetchedAt).toISOString(),
  }
}

export type FxService = ReturnType<typeof createFxService>
