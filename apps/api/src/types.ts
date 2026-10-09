import type { FastifyReply } from 'fastify'
import type { Env } from './env.js'
import type { Chain } from './lib/chain.js'
import type { FxService } from './lib/fx.js'
import type { Privy } from './lib/privy.js'
import type { Db } from './lib/prisma.js'

/** Who is calling, set by `app.authenticate`. */
export interface AuthUser {
  /** User id */
  sub: string
  address: `0x${string}`
  sessionId: string
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env
    db: Db
    fx: FxService
    chain: Chain
    privy: Privy
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }

  interface FastifyRequest {
    /** Only set on routes guarded by `app.authenticate`. */
    user: AuthUser
  }
}
