import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { idParam } from '../../lib/http.js'
import { createInviteController } from './controller.js'
import { createInviteRepository } from './repository.js'
import {
  acceptInviteSchema,
  createInviteSchema,
  getInviteSchema,
  listInvitesSchema,
  revokeInviteSchema,
} from './schemas.js'
import { createInviteService, inviteNotFound } from './service.js'

const invites: FastifyPluginAsyncZod = async (app) => {
  const repo = createInviteRepository(app.db)
  const controller = createInviteController(createInviteService({ repo, env: app.env }))
  // Employers invite workers, workers invite recipients. Which type a role may
  // create depends on the body, so the service checks that part.
  const inviter = { onRequest: [app.authenticate, app.requireRole('employer', 'worker')] }

  app.post('/invites', { ...inviter, schema: createInviteSchema }, controller.create)
  app.get('/invites', { ...inviter, schema: listInvitesSchema }, controller.listMine)
  app.delete(
    '/invites/:id',
    {
      ...inviter,
      preHandler: [app.requireOwnership((req) => repo.findCreatorId(idParam(req)), inviteNotFound)],
      schema: revokeInviteSchema,
    },
    controller.revoke,
  )

  // Public, so the link can be opened before signing in. Anyone signed in may accept.
  app.get('/invites/:code', { schema: getInviteSchema }, controller.getByCode)
  app.post(
    '/invites/:code/acceptance',
    { onRequest: [app.authenticate], schema: acceptInviteSchema },
    controller.accept,
  )
}

export default invites
