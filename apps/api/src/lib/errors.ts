/**
 * Every error response uses `{ error: { code, message, details? } }` so the web
 * app can map codes to human-friendly copy (PLAN §6.3).
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errorBody = (code: string, message: string, details?: unknown) => ({
  error: details === undefined ? { code, message } : { code, message, details },
})

export const badRequest = (code: string, message: string) => new AppError(400, code, message)
export const unauthorized = (message = 'Sign in required') =>
  new AppError(401, 'UNAUTHORIZED', message)
export const forbidden = (message = 'Not allowed') => new AppError(403, 'FORBIDDEN', message)
export const notFound = (code: string, message: string) => new AppError(404, code, message)
export const conflict = (code: string, message: string) => new AppError(409, code, message)
