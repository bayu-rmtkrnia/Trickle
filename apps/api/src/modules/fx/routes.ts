import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { deprecatedAlias } from '../../lib/http.js'
import { createFxController } from './controller.js'
import { getUsdIdrSchema, legacyUsdIdrSchema } from './schemas.js'

const fx: FastifyPluginAsyncZod = async (app) => {
  const controller = createFxController(app.fx)
  const cacheSeconds = app.env.FX_CACHE_SECONDS

  // No role guard: judge mode accounts have none, and the rate is not private.
  app.get(
    '/fx-rates/usd-idr',
    { onRequest: [app.authenticate], schema: getUsdIdrSchema(cacheSeconds) },
    controller.usdIdr,
  )

  // Old public path, still called before sign-in by the web app. Remove in Fitur 13.
  app.get(
    '/fx/usd-idr',
    {
      ...deprecatedAlias(`${app.prefix}/fx-rates/usd-idr`),
      schema: legacyUsdIdrSchema(cacheSeconds),
    },
    controller.legacyUsdIdr,
  )
}

export default fx
