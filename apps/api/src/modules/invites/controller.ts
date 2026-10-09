import type { Handler } from '../../lib/http.js'
import type {
  acceptInviteSchema,
  createInviteSchema,
  getInviteSchema,
  listInvitesSchema,
} from './schemas.js'
import type { InviteService } from './service.js'

export function createInviteController(service: InviteService) {
  const create: Handler<typeof createInviteSchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.user.sub, req.body))
  }

  const listMine: Handler<typeof listInvitesSchema> = async (req) => {
    const { type, ...page } = req.query
    return service.listMine(req.user.sub, type, page)
  }

  const getByCode: Handler<typeof getInviteSchema> = async (req) =>
    service.getByCode(req.params.code)

  const accept: Handler<typeof acceptInviteSchema> = async (req) =>
    service.accept(req.params.code, req.user.sub)

  return { create, listMine, getByCode, accept }
}
