import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createSessionController } from './controller.js'
import { createSessionRepository } from './repository.js'
import { createSessionSchema, deleteCurrentSessionSchema } from './schemas.js'
import { createSessionService } from './service.js'

const sessions: FastifyPluginAsyncZod = async (app) => {
  const controller = createSessionController(
    createSessionService({
      repo: createSessionRepository(app.db),
      privy: app.privy,
      env: app.env,
    }),
  )
  const signInLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } }

  app.post('/sessions', { config: signInLimit, schema: createSessionSchema }, controller.create)
  app.delete(
    '/sessions/current',
    { onRequest: [app.authenticate], schema: deleteCurrentSessionSchema },
    controller.deleteCurrent,
  )
}

export default sessions
