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

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message = kind,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError
