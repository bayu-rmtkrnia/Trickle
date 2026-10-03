import type { Handler } from '../../lib/http.js'
import type {
  createEmployerSchema,
  getMyEmployerSchema,
  listMyWorkersSchema,
  updateMyEmployerSchema,
} from './schemas.js'
import type { EmployerService } from './service.js'

export function createEmployerController(service: EmployerService) {
  const create: Handler<typeof createEmployerSchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.user.sub, req.body))
  }

  const getMine: Handler<typeof getMyEmployerSchema> = async (req) => service.getMine(req.user.sub)

  const updateMine: Handler<typeof updateMyEmployerSchema> = async (req) =>
    service.updateMine(req.user.sub, req.body)

  const listMyWorkers: Handler<typeof listMyWorkersSchema> = async (req) =>
    service.listMyWorkers(req.user.sub, req.query)

  return { create, getMine, updateMine, listMyWorkers }
}
