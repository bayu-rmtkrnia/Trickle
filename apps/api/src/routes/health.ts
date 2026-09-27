import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

const Health = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'down']),
  uptimeSeconds: z.number(),
  time: z.string(),
})

const health: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Service and database status',
        response: { 200: Health, 503: Health },
      },
    },
    async (_req, reply) => {
      let db: 'ok' | 'down' = 'ok'
      try {
        await app.db.$queryRaw`SELECT 1`
      } catch {
        db = 'down'
      }
      const body = {
        status: db === 'ok' ? ('ok' as const) : ('degraded' as const),
        db,
        uptimeSeconds: Math.round(process.uptime()),
        time: new Date().toISOString(),
      }
      return reply.code(db === 'ok' ? 200 : 503).send(body)
    },
  )
}

export default health
