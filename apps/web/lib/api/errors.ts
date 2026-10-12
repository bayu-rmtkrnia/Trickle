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
  | 'forbidden'
  | 'conflict'
  | 'network'
  | 'wallet-not-ready'
  | 'rate-limited'
  | 'validation'
  | 'configuration'
  | 'unavailable'
  | 'server'

export interface ApiErrorOptions {
  status?: number
  code?: string
  details?: unknown
  retryAfterMs?: number
}

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string | null
  readonly details?: unknown
  readonly retryAfterMs?: number

  /** Accepts both the options object used by the worker client and the
   * positional arguments used by the employer API that was merged from main. */
  constructor(
    public readonly kind: ApiErrorKind,
    message: string = kind,
    options: ApiErrorOptions | number = {},
    code: string | null = null,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
    const resolved = typeof options === 'number'
      ? { status: options, code: code ?? undefined, details }
      : options
    this.status = resolved.status ?? null
    this.code = resolved.code ?? null
    this.details = resolved.details
    this.retryAfterMs = resolved.retryAfterMs
  }

  /** Keep main's backend error-envelope mapping for employer API callers. */
  static fromResponse(status: number, code?: string, message?: string, details?: unknown) {
    const codeKinds: Record<string, ApiErrorKind> = {
      INVITE_NOT_FOUND: 'not-found',
      INVITE_ALREADY_ACCEPTED: 'used',
      INVITE_REVOKED: 'revoked',
      INVITE_EXPIRED: 'expired',
      CANNOT_ACCEPT_OWN_INVITE: 'self',
      WORKER_EXISTS: 'already-linked',
      RECIPIENT_EXISTS: 'already-linked',
      ALREADY_LINKED: 'already-linked',
      WALLET_NOT_READY: 'wallet-not-ready',
    }
    const statusKinds: Record<number, ApiErrorKind> = {
      400: 'validation',
      401: 'unauthorized',
      403: 'forbidden',
      404: 'not-found',
      409: 'conflict',
      410: 'expired',
      422: 'validation',
      429: 'rate-limited',
      503: 'unavailable',
    }
    const kind = (code && codeKinds[code]) ?? statusKinds[status] ?? 'server'
    return new ApiError(kind, message ?? kind, { status, code, details })
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError
