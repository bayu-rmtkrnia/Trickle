import type { ApiErrorResponse, ValidationErrorDetail } from '../types/api'

const API_PREFIX = '/api/v1'
const DEFAULT_API_URL = 'http://localhost:4000'

export class ApiError extends Error {
  readonly validationErrors: ValidationErrorDetail[]

  constructor(
    public readonly status: number | null,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    this.validationErrors =
      status === 422 && Array.isArray(details)
        ? details.filter(
            (item): item is ValidationErrorDetail =>
              typeof item === 'object' &&
              item !== null &&
              typeof item.field === 'string' &&
              typeof item.message === 'string',
          )
        : []
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  query?: Record<string, string | number | null | undefined>
  signal?: AbortSignal
  /** Requires an explicitly configured client; never inferred from Privy state. */
  auth?: boolean
}

export interface ApiClient {
  request<T>(path: `/${string}`, options?: ApiRequestOptions): Promise<T>
}

export interface ApiClientOptions {
  /** Backend base URL without /api/v1, /health or /docs. */
  baseUrl?: string
  /** Wire useAccount().getAccessToken ONLY after backend Privy migration. */
  getAccessToken?: () => Promise<string | null>
}

function isErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false
  const error = value.error
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  )
}

export function createApiClient(config: ApiClientOptions = {}): ApiClient {
  return {
    async request<T>(path: `/${string}`, options: ApiRequestOptions = {}): Promise<T> {
      const headers = new Headers({ Accept: 'application/json' })
      if (options.auth) {
        if (!config.getAccessToken) {
          throw new ApiError(
            null,
            'AUTH_NOT_CONFIGURED',
            'Protected API is not configured. Backend Privy verification is still required.',
          )
        }
        const token = await config.getAccessToken()
        if (!token?.trim()) throw new ApiError(null, 'AUTH_REQUIRED', 'Sign in required')
        headers.set('Authorization', `Bearer ${token}`)
      }

      const baseUrl = (config.baseUrl ?? process.env.NEXT_PUBLIC_API_URL?.trim()) || DEFAULT_API_URL
      let url: URL
      try {
        const base = new URL(baseUrl)
        if (
          !['http:', 'https:'].includes(base.protocol) ||
          base.username ||
          base.password ||
          base.search ||
          base.hash
        )
          throw new Error('Invalid API URL')
        url = new URL(`${base.href.replace(/\/+$/, '')}${API_PREFIX}${path}`)
      } catch {
        throw new ApiError(
          null,
          'API_CONFIG_ERROR',
          'Configure a valid HTTP(S) NEXT_PUBLIC_API_URL',
        )
      }
      for (const [key, value] of Object.entries(options.query ?? {})) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
      }

      const body = options.body === undefined ? undefined : JSON.stringify(options.body)
      if (body !== undefined) headers.set('Content-Type', 'application/json')
      let response: Response
      try {
        response = await fetch(url, {
          method: options.method ?? 'GET',
          headers,
          body,
          signal: options.signal,
          credentials: 'omit',
          cache: 'no-store',
        })
      } catch (error) {
        if (options.signal?.aborted) throw error
        throw new ApiError(null, 'NETWORK_ERROR', 'Could not reach the API')
      }

      let data: unknown
      try {
        if (response.status !== 204) data = await response.json()
      } catch (error) {
        if (options.signal?.aborted) throw error
        if (response.ok)
          throw new ApiError(response.status, 'INVALID_RESPONSE', 'API returned invalid JSON')
        // Proxies can return HTML or empty bodies. Preserve status, not their raw content.
      }
      if (!response.ok) {
        if (isErrorResponse(data)) {
          throw new ApiError(
            response.status,
            data.error.code,
            data.error.message,
            data.error.details,
          )
        }
        throw new ApiError(
          response.status,
          'HTTP_ERROR',
          `API request failed (HTTP ${response.status})`,
        )
      }
      // Compile-time contract only. No runtime success-schema validation is claimed.
      return data as T
    },
  }
}

// Public only. No account hook, token getter, session cookie, or legacy login flow.
export const api = createApiClient()
