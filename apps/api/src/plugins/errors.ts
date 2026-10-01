import type { FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod'
import { AppError, errorBody } from '../lib/errors.js'

/** Codes for 4xx errors raised by Fastify itself (bad JSON, wrong content type, ...). */
const FRAMEWORK_CODES: Record<number, string> = {
  400: 'MALFORMED_REQUEST',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
}

/**
 * 400 means the request could not be read at all (e.g. broken JSON).
 * 422 means it was readable but failed schema validation (PLAN §6.3).
 */
export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(errorBody(err.code, err.message, err.details))
    }

    if (hasZodFastifySchemaValidationErrors(err)) {
      const details = err.validation.map((v) => ({
        field: [err.validationContext, ...v.instancePath.split('/').filter(Boolean)].join('.'),
        message: v.message ?? 'is invalid',
      }))
      const first = details[0]
      return reply
        .code(422)
        .send(
          errorBody(
            'VALIDATION_ERROR',
            first ? `${first.field}: ${first.message}` : 'Request does not match the schema',
            details,
          ),
        )
    }

    if (isResponseSerializationError(err)) {
      req.log.error({ err, issues: err.cause.issues }, 'response serialization failed')
      return reply.code(500).send(errorBody('INTERNAL_ERROR', 'Something went wrong'))
    }

    const statusCode = (err as { statusCode?: number }).statusCode ?? 500
    if (statusCode === 429) {
      return reply
        .code(429)
        .send(errorBody('RATE_LIMITED', 'Too many requests, please try again shortly'))
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply
        .code(statusCode)
        .send(errorBody(FRAMEWORK_CODES[statusCode] ?? 'BAD_REQUEST', (err as Error).message))
    }

    req.log.error({ err }, 'unhandled error')
    return reply.code(500).send(errorBody('INTERNAL_ERROR', 'Something went wrong'))
  })

  app.setNotFoundHandler((req, reply) =>
    reply
      .code(404)
      .send(errorBody('ROUTE_NOT_FOUND', `No route for ${req.method} ${req.url.split('?')[0]}`)),
  )
}
