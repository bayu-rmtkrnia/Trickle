import type { Handler } from '../../lib/http.js'
import type { createSessionSchema, deleteCurrentSessionSchema } from './schemas.js'
import type { SessionService } from './service.js'

export function createSessionController(service: SessionService) {
  const create: Handler<typeof createSessionSchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.body.accessToken))
  }

  const deleteCurrent: Handler<typeof deleteCurrentSessionSchema> = async (req, reply) => {
    await service.revoke(req.user.sessionId)
    return reply.code(204).send(null)
  }

  return { create, deleteCurrent }
}
