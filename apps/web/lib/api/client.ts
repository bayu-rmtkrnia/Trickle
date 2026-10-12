import { ApiError, type ApiErrorKind } from './errors'

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  baseUrl?: string
  body?: unknown
  fetcher?: typeof fetch
  token?: string
  query?: Record<string, string | number | undefined>
}

type ErrorPayload = {
  error?: {
    code?: unknown
    message?: unknown
    details?: unknown
  }
}

function apiUrl(baseUrl?: string) {
  const value = (baseUrl ?? process.env.NEXT_PUBLIC_API_URL)?.trim().replace(/\/+$/, '')
  if (!value) {
    throw new ApiError('configuration', 'API Trickle belum dikonfigurasi', {
      code: 'API_NOT_CONFIGURED',
    })
  }
  return value
}

function errorKind(status: number, code: string): ApiErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'server'
  if (code === 'WALLET_NOT_READY') return 'wallet-not-ready'
  if (code === 'INVITE_ALREADY_ACCEPTED') return 'used'
  if (code === 'INVITE_REVOKED') return 'revoked'
  if (code === 'INVITE_EXPIRED') return 'expired'
  if (code === 'CANNOT_ACCEPT_OWN_INVITE') return 'self'
  if (code === 'ALREADY_LINKED') return 'already-linked'
  if (status === 409) return 'conflict'
  return 'network'
}

function retryAfterMilliseconds(header: string | null): number | undefined {
  const value = header?.trim()
  if (!value) return undefined
  if (/^\d+$/.test(value)) {
    const delay = Number(value) * 1000
    return Number.isFinite(delay) ? delay : undefined
  }
  if (!/^[A-Za-z]{3}, /.test(value)) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : undefined
}

async function responseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    if (response.ok) {
      throw new ApiError('server', 'Respons API tidak valid', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      })
    }
    return undefined
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { baseUrl, body, fetcher = fetch, token, query, ...requestInit } = options
  const url = new URL(`${apiUrl(baseUrl)}/${path.replace(/^\/+/, '')}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  const headers = new Headers()
  if (body !== undefined) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetcher(url, {
      ...requestInit,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
    })
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('network', 'Tidak dapat terhubung ke API Trickle', {
      code: 'NETWORK_ERROR',
      details: error,
    })
  }

  const payload = await responseBody(response)
  if (!response.ok) {
    const problem = (payload as ErrorPayload | undefined)?.error
    const code = typeof problem?.code === 'string' ? problem.code : `HTTP_${response.status}`
    const message =
      typeof problem?.message === 'string'
        ? problem.message
        : `Permintaan gagal (${response.status})`
    throw new ApiError(errorKind(response.status, code), message, {
      status: response.status,
      code,
      details: problem?.details,
      retryAfterMs:
        response.status === 429
          ? retryAfterMilliseconds(response.headers.get('retry-after'))
          : undefined,
    })
  }

  return payload as T
}
