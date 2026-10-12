import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createUserController } from './controller.js'
import { createUserRepository } from './repository.js'
import { getMeSchema, listMyEmploymentsSchema, updateMeSchema } from './schemas.js'
import { createUserService } from './service.js'

const users: FastifyPluginAsyncZod = async (app) => {
  const controller = createUserController(createUserService(createUserRepository(app.db)))
  const secured = { onRequest: [app.authenticate] }

  app.get('/users/me', { ...secured, schema: getMeSchema }, controller.getMe)
  app.patch('/users/me', { ...secured, schema: updateMeSchema }, controller.updateMe)
  // No role check: an account that is not a worker simply has no employments.
  app.get(
    '/users/me/employments',
    { ...secured, schema: listMyEmploymentsSchema },
    controller.listEmployments,
  )
}

export default users
