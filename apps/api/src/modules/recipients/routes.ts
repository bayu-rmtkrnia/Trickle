import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { idParam } from '../../lib/http.js'
import { createRecipientController } from './controller.js'
import { createRecipientRepository } from './repository.js'
import {
  createRecipientSchema,
  deleteRecipientSchema,
  getRecipientSchema,
  listRecipientsSchema,
  updateRecipientSchema,
} from './schemas.js'
import { createRecipientService, recipientNotFound } from './service.js'

const recipients: FastifyPluginAsyncZod = async (app) => {
  const repo = createRecipientRepository(app.db)
  const controller = createRecipientController(
    createRecipientService({ repo, streams: app.streams }),
  )
  const worker = [app.authenticate, app.requireRole('worker')]

  // The collection is always the signed-in worker's own, so no ownership check.
  app.post('/recipients', { onRequest: worker, schema: createRecipientSchema }, controller.create)
  app.get('/recipients', { onRequest: worker, schema: listRecipientsSchema }, controller.list)

  // /recipients/:id: the worker may read and change; the recipient may only read themself.
  const recipientOwner = (includeSelf: boolean) => async (id: string) => {
    const access = await repo.findAccess(id)
    if (!access) return null
    return includeSelf ? [access.ownerId, access.userId] : access.ownerId
  }
  app.get(
    '/recipients/:id',
    {
      onRequest: [app.authenticate, app.requireRole('worker', 'recipient')],
      preHandler: [
        app.requireOwnership((req) => recipientOwner(true)(idParam(req)), recipientNotFound),
      ],
      schema: getRecipientSchema,
    },
    controller.get,
  )
  const workerOnly = {
    onRequest: worker,
    preHandler: [
      app.requireOwnership((req) => recipientOwner(false)(idParam(req)), recipientNotFound),
    ],
  }
  app.patch('/recipients/:id', { ...workerOnly, schema: updateRecipientSchema }, controller.update)
  app.delete('/recipients/:id', { ...workerOnly, schema: deleteRecipientSchema }, controller.remove)
}

export default recipients
