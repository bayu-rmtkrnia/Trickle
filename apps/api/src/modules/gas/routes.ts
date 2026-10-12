import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { deprecatedAlias } from '../../lib/http.js'
import { createGasController } from './controller.js'
import { createGasRepository } from './repository.js'
import { dripSchema, gasStatusSchema, legacyDripSchema, legacyGasStatusSchema } from './schemas.js'
import { createGasService } from './service.js'

const gas: FastifyPluginAsyncZod = async (app) => {
  const controller = createGasController(
    createGasService({ repo: createGasRepository(app.db), chain: app.chain, env: app.env }),
  )
  // No role guard: judge mode accounts have none yet but need gas to withdraw.
  // Abuse is capped once per address, per IP per day, and per day overall.
  const drip = {
    onRequest: [app.authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }

  app.post('/gas-drips', { ...drip, schema: dripSchema }, controller.drip)
  app.get('/gas-drips/status', { schema: gasStatusSchema }, controller.status)

  // Old paths (before K1 naming), still used by the web app. Remove in Fitur 13.
  app.post(
    '/gas/drip',
    { ...drip, ...deprecatedAlias(`${app.prefix}/gas-drips`), schema: legacyDripSchema },
    controller.drip,
  )
  app.get(
    '/gas/status',
    { ...deprecatedAlias(`${app.prefix}/gas-drips/status`), schema: legacyGasStatusSchema },
    controller.status,
  )
}

export default gas
