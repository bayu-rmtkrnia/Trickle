import type { FxService } from '../../lib/fx.js'
import type { Handler } from '../../lib/http.js'
import type { getUsdIdrSchema, legacyUsdIdrSchema } from './schemas.js'

/** The rate provider client in `lib/fx.ts` is the service; there is no database here. */
export function createFxController(fx: FxService) {
  // Behind a session, so shared caches must not keep it.
  const usdIdr: Handler<ReturnType<typeof getUsdIdrSchema>> = async (_req, reply) => {
    const quote = await fx.usdIdr()
    reply.header('cache-control', 'private, max-age=60')
    return quote
  }

  const legacyUsdIdr: Handler<ReturnType<typeof legacyUsdIdrSchema>> = async (_req, reply) => {
    const quote = await fx.usdIdr()
    reply.header('cache-control', 'public, max-age=60')
    return quote
  }

  return { usdIdr, legacyUsdIdr }
}
