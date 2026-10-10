import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createGasController } from './controller.js'
import { createGasRepository } from './repository.js'
import { dripSchema, gasStatusSchema } from './schemas.js'
import { createGasService } from './service.js'

const gas: FastifyPluginAsyncZod = async (app) => {
  const controller = createGasController(
    createGasService({ repo: createGasRepository(app.db), chain: app.chain, env: app.env }),
  )

  app.post(
    '/gas/drip',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: dripSchema,
    },
    controller.drip,
  )
  app.get('/gas/status', { schema: gasStatusSchema }, controller.status)
}

export default gas
