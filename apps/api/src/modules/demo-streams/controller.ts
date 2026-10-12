import type { Handler } from '../../lib/http.js'
import type { createDemoStreamSchema, demoStatusSchema } from './schemas.js'
import type { DemoStreamService } from './service.js'

export function createDemoStreamController(service: DemoStreamService) {
  const create: Handler<typeof createDemoStreamSchema> = async (req, reply) => {
    const user = { id: req.user.sub, address: req.user.address }
    const result = await service.start(user, req.ip, req.log)
    return reply.code(result.created ? 201 : 200).send(result.stream)
  }

  const status: Handler<typeof demoStatusSchema> = async (req) => service.status(req.log)

  return { create, status }
}
