import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

const FxQuote = z
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

const fx: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/fx/usd-idr',
    {
      schema: {
        tags: ['FX'],
        summary: 'USD to IDR exchange rate (display and estimates only)',
        description: `Cached for ${app.env.FX_CACHE_SECONDS} seconds. Falls back to the last good rate, then to a static rate, and says which one it is.`,
        response: { 200: FxQuote },
      },
    },
    async (_req, reply) => {
      const quote = await app.fx.usdIdr()
      reply.header('cache-control', 'public, max-age=60')
      return quote
    },
  )
}

export default fx
