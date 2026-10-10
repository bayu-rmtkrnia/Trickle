import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify, { type FastifyServerOptions } from 'fastify'
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import type { Env } from './env.js'
import { createChain, type Chain } from './lib/chain.js'
import { createFxService, type FxService } from './lib/fx.js'
import { createPrisma, type Db } from './lib/prisma.js'
import { createPrivy, type Privy } from './lib/privy.js'
import companyRoutes from './modules/companies/routes.js'
import fxRoutes from './modules/fx/routes.js'
import gasRoutes from './modules/gas/routes.js'
import healthRoutes from './modules/health/routes.js'
import inviteRoutes from './modules/invites/routes.js'
import sessionRoutes from './modules/sessions/routes.js'
import userRoutes from './modules/users/routes.js'
import authPlugin from './plugins/auth.js'
import rbacPlugin from './plugins/rbac.js'
import { registerErrorHandling } from './plugins/errors.js'
import './types.js'

/** Every resource endpoint lives under this prefix (PLAN §6.3). */
export const API_PREFIX = '/api/v1'

export interface AppDeps {
  env: Env
  db?: Db
  fx?: FxService
  chain?: Chain
  privy?: Privy
  logger?: FastifyServerOptions['logger']
  /** Per-IP rate limiting. Integration tests turn it off because every request shares one IP. */
  rateLimit?: boolean
}

export async function buildApp(deps: AppDeps) {
  const { env } = deps
  const app = Fastify({
    logger: deps.logger ?? (env.NODE_ENV === 'test' ? false : { level: 'info' }),
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  const db = deps.db ?? createPrisma(env.DATABASE_URL)
  app.decorate('env', env)
  app.decorate('db', db)
  app.decorate(
    'fx',
    deps.fx ??
      createFxService({
        url: env.FX_API_URL,
        cacheSeconds: env.FX_CACHE_SECONDS,
        fallbackRate: env.FX_FALLBACK_USD_IDR,
      }),
  )
  app.decorate('chain', deps.chain ?? createChain(env))
  app.decorate(
    'privy',
    deps.privy ??
      createPrivy({
        appId: env.PRIVY_APP_ID,
        appSecret: env.PRIVY_APP_SECRET,
        verificationKey: env.PRIVY_VERIFICATION_KEY,
      }),
  )
  if (!deps.db) app.addHook('onClose', () => db.$disconnect())

  registerErrorHandling(app)

  // Swagger UI serves inline scripts, so CSP is left to the web app's host.
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true })
  if (deps.rateLimit !== false) {
    await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Trickle API',
        version: '1.1.0',
        description:
          'Metadata API for Trickle: sessions, users, companies, invites, gas sponsorship and FX. Money lives on-chain; this API never stores balances.\n\n' +
          'Sign in by exchanging a Privy access token at `POST /api/v1/sessions`, then send the returned token as `Authorization: Bearer <token>`.\n\n' +
          'Resource endpoints live under `/api/v1`. Errors always use `{ error: { code, message, details? } }`: 400 for unreadable requests, 422 for schema validation failures (one `details` entry per field). ' +
          'List endpoints take `?limit=&cursor=` and return `{ data, nextCursor }`.',
      },
      tags: [
        { name: 'System' },
        { name: 'Sessions' },
        { name: 'Users' },
        { name: 'Companies' },
        { name: 'Invites' },
        { name: 'Gas' },
        { name: 'FX' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer' },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(authPlugin)
  await app.register(rbacPlugin)
  // Infrastructure endpoints stay unversioned so the Railway healthcheck and docs URL never move.
  await app.register(healthRoutes)
  await app.register(
    async (v1) => {
      await v1.register(sessionRoutes)
      await v1.register(userRoutes)
      await v1.register(companyRoutes)
      await v1.register(inviteRoutes)
      await v1.register(gasRoutes)
      await v1.register(fxRoutes)
    },
    { prefix: API_PREFIX },
  )

  return app
}
