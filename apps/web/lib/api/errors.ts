/**
 * Error API yang sudah dipetakan ke *kondisi* (DESIGN.md 7.4), bukan `code`
 * mentah dari backend. UI hanya membaca `kind`.
 */
export type ApiErrorKind =
  | 'not-found'
  | 'used'
  | 'revoked'
  | 'expired'
  | 'self'
  | 'already-linked'
  | 'unauthorized'
  | 'conflict'
  | 'network'
  | 'wallet-not-ready'
  | 'rate-limited'
  | 'validation'
  | 'configuration'
  | 'server'

export interface ApiErrorOptions {
  status?: number
  code?: string
  details?: unknown
  retryAfterMs?: number
}

export class ApiError extends Error {
  readonly status?: number
  readonly code?: string
  readonly details?: unknown
  readonly retryAfterMs?: number

  constructor(
    public readonly kind: ApiErrorKind,
    message: string = kind,
    options: ApiErrorOptions = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
    this.retryAfterMs = options.retryAfterMs
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError
