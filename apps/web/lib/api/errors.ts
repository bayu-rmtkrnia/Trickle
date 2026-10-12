/**
 * Error API yang sudah dipetakan ke *kondisi* (DESIGN.md 7.4). UI membaca
 * `kind`; `code` dan `status` asli dari backend disimpan untuk kasus khusus,
 * tapi tidak pernah ditampilkan ke pengguna.
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
  | 'validation'
  | 'rate-limited'
  | 'unavailable'
  | 'server'
  | 'network'

/** Kode backend yang punya kondisi sendiri; sisanya dipetakan dari status HTTP. */
const KIND_BY_CODE: Record<string, ApiErrorKind> = {
  INVITE_NOT_FOUND: 'not-found',
  INVITE_ALREADY_ACCEPTED: 'used',
  INVITE_REVOKED: 'revoked',
  INVITE_EXPIRED: 'expired',
  CANNOT_ACCEPT_OWN_INVITE: 'self',
  WORKER_EXISTS: 'already-linked',
  RECIPIENT_EXISTS: 'already-linked',
}

function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 409) return 'conflict'
  if (status === 410) return 'expired'
  if (status === 400 || status === 422) return 'validation'
  if (status === 429) return 'rate-limited'
  if (status === 503) return 'unavailable'
  return 'server'
}

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string = kind,
    public readonly status: number | null = null,
    public readonly code: string | null = null,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Dari envelope backend `{ error: { code, message, details? } }`. */
  static fromResponse(status: number, code?: string, message?: string, details?: unknown) {
    const kind = (code && KIND_BY_CODE[code]) || kindFromStatus(status)
    return new ApiError(kind, message ?? kind, status, code ?? null, details)
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError
