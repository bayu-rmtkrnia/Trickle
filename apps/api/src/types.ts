import type { Env } from './env.js'
import type { Db } from './lib/prisma.js'

declare module 'fastify' {
  interface FastifyInstance {
    env: Env
    db: Db
  }
}
