import { api, type ApiClient } from '../lib/api'
import type { FxQuote } from '../types/api'

/** Public display/estimate quote. Respect source: live, cache, or fallback. */
export function getUsdIdrRate(client: ApiClient = api): Promise<FxQuote> {
  return client.request('/fx/usd-idr')
}
