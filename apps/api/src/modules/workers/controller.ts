import type { Handler } from '../../lib/http.js'
import type {
  createWorkerSchema,
  deleteWorkerSchema,
  getWorkerSchema,
  listWorkersSchema,
  updateWorkerSchema,
} from './schemas.js'
import type { WorkerService } from './service.js'

export function createWorkerController(service: WorkerService) {
  const create: Handler<typeof createWorkerSchema> = async (req, reply) => {
    const worker = await service.create(req.params.id, req.user.sub, req.body)
    return reply.code(201).send(worker)
  }

  const list: Handler<typeof listWorkersSchema> = async (req) =>
    service.list(req.params.id, req.query)

  const get: Handler<typeof getWorkerSchema> = async (req) => service.get(req.params.id)

  const update: Handler<typeof updateWorkerSchema> = async (req) =>
    service.update(req.params.id, req.body)

  const remove: Handler<typeof deleteWorkerSchema> = async (req, reply) => {
    await service.remove(req.params.id, req.log)
    return reply.code(204).send(null)
  }

  return { create, list, get, update, remove }
}
