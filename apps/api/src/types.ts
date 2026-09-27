import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Env } from './env.js'
import type { FxService } from './lib/fx.js'
import type { Db } from './lib/prisma.js'

export interface Session {
  sub: string
  address: `0x${string}`
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env
    db: Db
    fx: FxService
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: Session
    user: Session
  }
}
