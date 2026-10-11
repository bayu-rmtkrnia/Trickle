import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Env } from './env.js'
import type { Chain } from './lib/chain.js'
import type { AppError } from './lib/errors.js'
import type { FxService } from './lib/fx.js'
import type { Privy } from './lib/privy.js'
import type { Db } from './lib/prisma.js'
import type { Role, Roles } from './lib/roles.js'

/** Who is calling, set by `app.authenticate`. */
export interface AuthUser {
  /** User id */
  sub: string
  address: `0x${string}`
  sessionId: string
}

type Guard = (req: FastifyRequest) => Promise<void>

declare module 'fastify' {
  interface FastifyInstance {
    env: Env
    db: Db
    fx: FxService
    chain: Chain
    privy: Privy
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    /** 403 unless the caller holds at least one of `roles`. */
    requireRole: (...roles: Role[]) => Guard
    /**
     * 404 (`onMissing`) when `ownerOf` returns null, 403 when the owner is
     * someone else. `ownerOf` returns the owning user id.
     */
    requireOwnership: (
      ownerOf: (req: FastifyRequest) => Promise<string | null>,
      onMissing?: () => AppError,
    ) => Guard
  }

  interface FastifyRequest {
    /** Only set on routes guarded by `app.authenticate`. */
    user: AuthUser
    /** Filled lazily by `app.requireRole`; null until then. */
    roles: Roles | null
  }
}
