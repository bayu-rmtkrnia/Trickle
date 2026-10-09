import type { Handler } from '../../lib/http.js'
import type { getHealthSchema } from './schemas.js'
import type { HealthService } from './service.js'

export function createHealthController(service: HealthService) {
  const get: Handler<typeof getHealthSchema> = async (_req, reply) => {
    const body = await service.check()
    return reply.code(body.status === 'ok' ? 200 : 503).send(body)
  }
  return { get }
}
