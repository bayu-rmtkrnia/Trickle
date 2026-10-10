import { ApiError, type ApiErrorKind } from './errors'

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  baseUrl?: string
  body?: unknown
  fetcher?: typeof fetch
  token?: string
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
  const { baseUrl, body, fetcher = fetch, token, ...requestInit } = options
  const headers = new Headers()
  if (body !== undefined) headers.set('content-type', 'application/json')
  if (token) headers.set('authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetcher(`${apiUrl(baseUrl)}/${path.replace(/^\/+/, '')}`, {
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
    })
  }

  return payload as T
}
