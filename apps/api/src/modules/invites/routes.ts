import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createInviteController } from './controller.js'
import { createInviteRepository } from './repository.js'
import {
  acceptInviteSchema,
  createInviteSchema,
  getInviteSchema,
  listInvitesSchema,
} from './schemas.js'
import { createInviteService } from './service.js'

const invites: FastifyPluginAsyncZod = async (app) => {
  const controller = createInviteController(
    createInviteService({ repo: createInviteRepository(app.db), env: app.env }),
  )
  const secured = { onRequest: [app.authenticate] }

  app.post('/invites', { ...secured, schema: createInviteSchema }, controller.create)
  app.get('/invites', { ...secured, schema: listInvitesSchema }, controller.listMine)
  app.get('/invites/:code', { schema: getInviteSchema }, controller.getByCode)
  app.post('/invites/:code/accept', { ...secured, schema: acceptInviteSchema }, controller.accept)
}

export default invites
