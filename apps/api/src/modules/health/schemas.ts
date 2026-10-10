import type { FastifySchema } from 'fastify'
import { z } from 'zod'

export const Health = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'down']),
  uptimeSeconds: z.number(),
  time: z.string(),
})

export type Health = z.infer<typeof Health>

export const getHealthSchema = {
  tags: ['System'],
  summary: 'Service and database status',
  response: { 200: Health, 503: Health },
} satisfies FastifySchema
