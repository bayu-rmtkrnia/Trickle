import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createFxController } from './controller.js'
import { getUsdIdrSchema } from './schemas.js'

const fx: FastifyPluginAsyncZod = async (app) => {
  const controller = createFxController(app.fx)

  app.get('/fx/usd-idr', { schema: getUsdIdrSchema(app.env.FX_CACHE_SECONDS) }, controller.usdIdr)
}

export default fx
