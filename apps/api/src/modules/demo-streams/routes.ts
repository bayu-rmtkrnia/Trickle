import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createDemoStreamController } from './controller.js'
import { createDemoStreamRepository } from './repository.js'
import { createDemoStreamSchema, demoStatusSchema } from './schemas.js'
import { createDemoStreamService } from './service.js'

const demoStreams: FastifyPluginAsyncZod = async (app) => {
  const controller = createDemoStreamController(
    createDemoStreamService({
      repo: createDemoStreamRepository(app.db),
      demo: app.demo,
      env: app.env,
    }),
  )

  // No role guard: a judge's account is brand new. The per-IP daily cap lives
  // in the service so it survives restarts; this limit only slows down bursts.
  app.post(
    '/demo-streams',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: createDemoStreamSchema,
    },
    controller.create,
  )
  app.get('/demo-streams/status', { schema: demoStatusSchema }, controller.status)
}

export default demoStreams
