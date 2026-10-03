import type {
  ContextConfigDefault,
  FastifySchema,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
} from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

/**
 * Type of a controller method for a route with schema `S`. Lets controllers live
 * outside `app.get(...)` and still get `req.body`/`req.params`/reply types
 * inferred from the Zod schema, exactly as an inline handler would.
 */
export type Handler<S extends FastifySchema> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RouteGenericInterface,
  ContextConfigDefault,
  S,
  ZodTypeProvider
>
