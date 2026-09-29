import { z } from 'zod'

export const ErrorResponse = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  })
  .meta({ id: 'Error' })

export const Address = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address')
  .transform((a) => a.toLowerCase() as `0x${string}`)

/** Standard error responses to spread into a route's `response` map. */
export const errors = (...codes: (400 | 401 | 403 | 404 | 409 | 410 | 429 | 502 | 503)[]) =>
  Object.fromEntries(codes.map((c) => [c, ErrorResponse])) as Record<number, typeof ErrorResponse>
