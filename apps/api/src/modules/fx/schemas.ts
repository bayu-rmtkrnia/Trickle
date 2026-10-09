import type { FastifySchema } from 'fastify'
import { z } from 'zod'

export const FxQuote = z
  .object({
    base: z.literal('USD'),
    quote: z.literal('IDR'),
    rate: z.number().describe('IDR per 1 USD'),
    source: z
      .enum(['live', 'cache', 'fallback'])
      .describe('`fallback` means the provider was unreachable and no cached rate exists'),
    rateTime: z.string().nullable().describe('When the provider last updated the rate'),
    fetchedAt: z.string().nullable().describe('When this server fetched the rate'),
  })
  .meta({ id: 'FxQuote' })

export const getUsdIdrSchema = (cacheSeconds: number) =>
  ({
    tags: ['FX'],
    summary: 'USD to IDR exchange rate (display and estimates only)',
    description: `Cached for ${cacheSeconds} seconds. Falls back to the last good rate, then to a static rate, and says which one it is.`,
    response: { 200: FxQuote },
  }) satisfies FastifySchema
