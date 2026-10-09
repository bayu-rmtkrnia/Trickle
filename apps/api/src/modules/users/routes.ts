import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createUserController } from './controller.js'
import { createUserRepository } from './repository.js'
import { getMeSchema, updateMeSchema } from './schemas.js'
import { createUserService } from './service.js'

const users: FastifyPluginAsyncZod = async (app) => {
  const controller = createUserController(createUserService(createUserRepository(app.db)))
  const secured = { onRequest: [app.authenticate] }

  app.get('/users/me', { ...secured, schema: getMeSchema }, controller.getMe)
  app.patch('/users/me', { ...secured, schema: updateMeSchema }, controller.updateMe)
}

export default users
