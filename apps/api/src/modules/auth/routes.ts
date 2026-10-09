import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createAuthController } from './controller.js'
import { createAuthRepository } from './repository.js'
import { challengeSchema, meSchema, verifySchema } from './schemas.js'
import { createAuthService } from './service.js'

const auth: FastifyPluginAsyncZod = async (app) => {
  const service = createAuthService({
    repo: createAuthRepository(app.db),
    env: app.env,
    signToken: async (session) => app.jwt.sign(session),
  })
  const controller = createAuthController(service)
  const signInLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } }

  app.post(
    '/auth/challenge',
    { config: signInLimit, schema: challengeSchema },
    controller.challenge,
  )
  app.post('/auth/verify', { config: signInLimit, schema: verifySchema }, controller.verify)
  app.get('/auth/me', { onRequest: [app.authenticate], schema: meSchema }, controller.me)
}

export default auth
