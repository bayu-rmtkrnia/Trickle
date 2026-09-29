import type { FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import { AppError } from '../lib/errors.js'

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ code: err.code, message: err.message })
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      const first = err.validation[0]
      const field = first?.instancePath?.replace(/^\//, '').replaceAll('/', '.')
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: first
          ? `${field ? `${field}: ` : ''}${first.message}`
          : 'Request does not match the schema',
        details: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
      })
    }

    if (isResponseSerializationError(err)) {
      req.log.error({ err, issues: err.cause.issues }, 'response serialization failed')
      return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong' })
    }

    const statusCode = (err as { statusCode?: number }).statusCode ?? 500
    if (statusCode === 429) {
      return reply
        .code(429)
        .send({ code: 'RATE_LIMITED', message: 'Too many requests, please try again shortly' })
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({
        code: (err as { code?: string }).code ?? 'BAD_REQUEST',
        message: (err as Error).message,
      })
    }

    req.log.error({ err }, 'unhandled error')
    return reply.code(500).send({ code: 'INTERNAL_ERROR', message: 'Something went wrong' })
  })

  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send({ code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.url}` }),
  )
}
