import type { Handler } from '../../lib/http.js'
import type {
  createRecipientSchema,
  deleteRecipientSchema,
  getRecipientSchema,
  listRecipientsSchema,
  updateRecipientSchema,
} from './schemas.js'
import type { RecipientService } from './service.js'

export function createRecipientController(service: RecipientService) {
  const create: Handler<typeof createRecipientSchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.user.sub, req.body))
  }

  const list: Handler<typeof listRecipientsSchema> = async (req) =>
    service.list(req.user.sub, req.query)

  const get: Handler<typeof getRecipientSchema> = async (req) => service.get(req.params.id)

  const update: Handler<typeof updateRecipientSchema> = async (req) =>
    service.update(req.params.id, req.body)

  const remove: Handler<typeof deleteRecipientSchema> = async (req, reply) => {
    await service.remove(req.params.id, req.log)
    return reply.code(204).send(null)
  }

  return { create, list, get, update, remove }
}
