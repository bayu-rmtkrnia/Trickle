import type {
  ContextConfigDefault,
  FastifyRequest,
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

/**
 * The `:id` param, for guards such as `app.requireOwnership` that are not typed
 * per route. Use them in `preHandler`, where Zod has already validated params.
 */
export const idParam = (req: FastifyRequest) => (req.params as { id: string }).id
