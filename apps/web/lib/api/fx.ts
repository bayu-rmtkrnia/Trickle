import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

export interface FxQuoteDto {
  base: 'USD'
  quote: 'IDR'
  /** IDR per 1 USD. Display and estimates only; payouts use the server rate. */
  rate: number
  source: 'live' | 'cache' | 'fallback'
  rateTime: string | null
  fetchedAt: string | null
}

const validTime = (value: unknown) =>
  value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))

export async function getUsdIdr(
  token: string,
  options: Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'> = {},
): Promise<FxQuoteDto> {
  const value = await apiRequest<FxQuoteDto>('fx-rates/usd-idr', { ...options, token })
  if (
    !value ||
    value.base !== 'USD' ||
    value.quote !== 'IDR' ||
    typeof value.rate !== 'number' ||
    !Number.isFinite(value.rate) ||
    value.rate <= 0 ||
    !['live', 'cache', 'fallback'].includes(value.source) ||
    !validTime(value.rateTime) ||
    !validTime(value.fetchedAt)
  )
    throw new ApiError('server', 'Respons kurs tidak valid', { code: 'INVALID_RESPONSE' })
  return value
}
