import type { Handler } from '../../lib/http.js'
import type { challengeSchema, meSchema, verifySchema } from './schemas.js'
import type { AuthService } from './service.js'

export function createAuthController(service: AuthService) {
  const challenge: Handler<typeof challengeSchema> = async (req, reply) => {
    return reply.code(201).send(await service.createChallenge(req.body.address))
  }

  const verify: Handler<typeof verifySchema> = async (req) => {
    const { message, signature } = req.body
    return service.verify(message, signature as `0x${string}`)
  }

  const me: Handler<typeof meSchema> = async (req) => service.me(req.user.sub)

  return { challenge, verify, me }
}
