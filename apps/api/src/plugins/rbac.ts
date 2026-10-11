import type { FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { forbidden, notFound, unauthorized, type AppError } from '../lib/errors.js'
import { toRoles, type Role, type Roles } from '../lib/roles.js'
import { createUserRepository } from '../modules/users/repository.js'

interface Options {
  /** Roles of a user, or null if the account is gone. Tests pass a fake. */
  loadRoles?: (userId: string) => Promise<Roles | null>
}

/**
 * Authorization guards. Both run after `app.authenticate`:
 *
 *   onRequest: [app.authenticate, app.requireRole('employer')]
 *   preHandler: [app.requireOwnership((req) => repo.ownerOf(req.params.id))]
 *
 * Rules that depend on the request body (e.g. which invite type you may send)
 * stay in the service.
 */
export default fp<Options>(async (app, opts) => {
  const loadRoles =
    opts.loadRoles ??
    (async (userId: string) => {
      const user = await createUserRepository(app.db).findWithRoleCounts(userId)
      return user && toRoles(user)
    })

  app.decorateRequest('roles', null)

  /** Loads the caller's roles once per request. */
  async function rolesOf(req: FastifyRequest) {
    if (!req.user) throw unauthorized()
    if (!req.roles) {
      const roles = await loadRoles(req.user.sub)
      if (!roles) throw unauthorized('Account no longer exists. Sign in again.')
      req.roles = roles
    }
    return req.roles
  }

  app.decorate('requireRole', (...allowed: Role[]) => async (req: FastifyRequest) => {
    const roles = await rolesOf(req)
    if (!allowed.some((r) => roles[r])) {
      throw forbidden(`Only ${allowed.join(' or ')} accounts can do this`)
    }
  })

  app.decorate(
    'requireOwnership',
    (
      ownerOf: (req: FastifyRequest) => Promise<string | null>,
      onMissing: () => AppError = () => notFound('NOT_FOUND', 'Resource not found'),
    ) =>
      async (req: FastifyRequest) => {
        if (!req.user) throw unauthorized()
        const ownerId = await ownerOf(req)
        if (ownerId === null) throw onMissing()
        if (ownerId !== req.user.sub) throw forbidden('This belongs to another account')
      },
  )
})
