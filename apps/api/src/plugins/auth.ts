import fp from 'fastify-plugin'
import { unauthorized } from '../lib/errors.js'
import { hashToken } from '../lib/tokens.js'
import { createSessionRepository } from '../modules/sessions/repository.js'

/** Resolves `Authorization: Bearer <session token>` into `req.user`. */
export default fp(async (app) => {
  const sessions = createSessionRepository(app.db)

  app.decorateRequest('user', null as never)
  app.decorate('authenticate', async (req) => {
    const [scheme, token] = req.headers.authorization?.split(' ') ?? []
    const session =
      scheme?.toLowerCase() === 'bearer' && token
        ? await sessions.findActive(hashToken(token))
        : null
    if (!session) throw unauthorized('Missing or expired session. Sign in again.')
    req.user = {
      sub: session.user.id,
      address: session.user.address as `0x${string}`,
      sessionId: session.id,
    }
  })
})
