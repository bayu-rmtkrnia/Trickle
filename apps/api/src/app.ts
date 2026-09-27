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
import { createFxService, type FxService } from './lib/fx.js'
import { createPrisma, type Db } from './lib/prisma.js'
import authPlugin from './plugins/auth.js'
import { registerErrorHandling } from './plugins/errors.js'
import authRoutes from './routes/auth.js'
import employerRoutes from './routes/employers.js'
import fxRoutes from './routes/fx.js'
import healthRoutes from './routes/health.js'
import inviteRoutes from './routes/invites.js'
import './types.js'

export interface AppDeps {
  env: Env
  db?: Db
  fx?: FxService
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
        version: '0.1.0',
        description:
          'Metadata API for Trickle: auth, employers, invites, gas sponsorship and FX. Money lives on-chain; this API never stores balances.',
      },
      tags: [
        { name: 'System' },
        { name: 'Auth' },
        { name: 'Employers' },
        { name: 'Invites' },
        { name: 'Gas' },
        { name: 'FX' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(authPlugin)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(employerRoutes)
  await app.register(inviteRoutes)
  await app.register(fxRoutes)

  return app
}
