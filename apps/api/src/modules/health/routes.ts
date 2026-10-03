import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createHealthController } from './controller.js'
import { createHealthRepository } from './repository.js'
import { getHealthSchema } from './schemas.js'
import { createHealthService } from './service.js'

const health: FastifyPluginAsyncZod = async (app) => {
  const controller = createHealthController(createHealthService(createHealthRepository(app.db)))

  app.get('/health', { schema: getHealthSchema }, controller.get)
}

export default health
