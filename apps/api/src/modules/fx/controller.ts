import type { FxService } from '../../lib/fx.js'
import type { Handler } from '../../lib/http.js'
import type { getUsdIdrSchema } from './schemas.js'

/** The rate provider client in `lib/fx.ts` is the service; there is no database here. */
export function createFxController(fx: FxService) {
  const usdIdr: Handler<ReturnType<typeof getUsdIdrSchema>> = async (_req, reply) => {
    const quote = await fx.usdIdr()
    reply.header('cache-control', 'public, max-age=60')
    return quote
  }
  return { usdIdr }
}
