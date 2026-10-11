import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createEmployerController } from './controller.js'
import { createEmployerRepository } from './repository.js'
import {
  createEmployerSchema,
  getMyEmployerSchema,
  listMyWorkersSchema,
  updateMyEmployerSchema,
} from './schemas.js'
import { createEmployerService } from './service.js'

const employers: FastifyPluginAsyncZod = async (app) => {
  const controller = createEmployerController(
    createEmployerService(createEmployerRepository(app.db)),
  )
  const secured = { onRequest: [app.authenticate] }
  const employerOnly = { onRequest: [app.authenticate, app.requireRole('employer')] }

  // Anyone can create a company (that is how you become an employer) and ask for
  // their own profile (404 tells the web app to show onboarding).
  app.post('/employers', { ...secured, schema: createEmployerSchema }, controller.create)
  app.get('/employers/me', { ...secured, schema: getMyEmployerSchema }, controller.getMine)
  app.patch(
    '/employers/me',
    { ...employerOnly, schema: updateMyEmployerSchema },
    controller.updateMine,
  )
  app.get(
    '/employers/me/workers',
    { ...employerOnly, schema: listMyWorkersSchema },
    controller.listMyWorkers,
  )
}

export default employers
