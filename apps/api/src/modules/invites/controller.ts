import type { Handler } from '../../lib/http.js'
import type {
  acceptInviteSchema,
  createInviteSchema,
  getInviteSchema,
  listInvitesSchema,
  revokeInviteSchema,
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

  const accept: Handler<typeof acceptInviteSchema> = async (req, reply) => {
    return reply.code(201).send(await service.accept(req.params.code, req.user.sub))
  }

  const revoke: Handler<typeof revokeInviteSchema> = async (req, reply) => {
    await service.revoke(req.params.id)
    return reply.code(204).send(null)
  }

  return { create, listMine, getByCode, accept, revoke }
}
