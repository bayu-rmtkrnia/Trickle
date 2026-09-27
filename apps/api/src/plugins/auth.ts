import fastifyJwt from '@fastify/jwt'
import fp from 'fastify-plugin'
import { unauthorized } from '../lib/errors.js'

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: app.env.JWT_SECRET,
    sign: { expiresIn: app.env.JWT_EXPIRES_IN },
  })

  app.decorate('authenticate', async (req) => {
    try {
      await req.jwtVerify()
    } catch {
      throw unauthorized('Missing or expired session. Sign in again.')
    }
  })
})
