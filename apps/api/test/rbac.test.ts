import Fastify, { type FastifyRequest } from 'fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { notFound } from '../src/lib/errors.js'
import type { Roles } from '../src/lib/roles.js'
import { registerErrorHandling } from '../src/plugins/errors.js'
import rbac from '../src/plugins/rbac.js'
import '../src/types.js'

const none: Roles = { employer: false, worker: false, family: false }
const roles: Record<string, Roles> = {
  boss: { ...none, employer: true },
  siti: { ...none, worker: true },
  ibu: { ...none, family: true },
}
/** Documents and their owners, for the ownership guard. */
const docs: Record<string, string> = { 'doc-1': 'boss' }

// No database: `x-user` stands in for a signed-in session, roles come from the map above.
describe('rbac guards', () => {
  const app = Fastify()
  const loadRoles = vi.fn(async (userId: string) => roles[userId] ?? null)
  const ok = async () => ({ ok: true })

  beforeAll(async () => {
    registerErrorHandling(app)
    await app.register(rbac, { loadRoles })
    const signedIn = async (req: FastifyRequest) => {
      const sub = req.headers['x-user']
      if (typeof sub === 'string') req.user = { sub, address: '0x0', sessionId: 's' }
    }

    app.get('/employer-only', { onRequest: [signedIn, app.requireRole('employer')] }, ok)
    app.get(
      '/worker-or-family',
      { onRequest: [signedIn, app.requireRole('worker', 'family')] },
      async (req) => {
        // A second guard on the same request reuses the loaded roles.
        await app.requireRole('family', 'worker')(req)
        return { ok: true }
      },
    )
    app.get(
      '/docs/:id',
      {
        onRequest: [signedIn],
        preHandler: [
          app.requireOwnership(
            async (req) => docs[(req.params as { id: string }).id] ?? null,
            () => notFound('DOC_NOT_FOUND', 'No such doc'),
          ),
        ],
      },
      ok,
    )
    app.get('/no-auth-hook', { onRequest: [app.requireRole('employer')] }, ok)
    await app.ready()
  })

  afterAll(() => app.close())

  const get = (url: string, user?: string) =>
    app.inject({ method: 'GET', url, headers: user ? { 'x-user': user } : {} })

  it('lets a holder of the role through', async () => {
    expect((await get('/employer-only', 'boss')).statusCode).toBe(200)
  })

  it('answers 403 in the error envelope for other roles', async () => {
    for (const user of ['siti', 'ibu']) {
      const res = await get('/employer-only', user)
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({
        error: { code: 'FORBIDDEN', message: 'Only employer accounts can do this' },
      })
    }
  })

  it('accepts any of several roles and loads roles once per request', async () => {
    loadRoles.mockClear()
    expect((await get('/worker-or-family', 'siti')).statusCode).toBe(200)
    expect((await get('/worker-or-family', 'ibu')).statusCode).toBe(200)
    expect((await get('/worker-or-family', 'boss')).statusCode).toBe(403)
    expect(loadRoles).toHaveBeenCalledTimes(3)
  })

  it('answers 401 when the account is gone or the route forgot to authenticate', async () => {
    expect((await get('/employer-only', 'deleted')).statusCode).toBe(401)
    expect((await get('/no-auth-hook', 'boss')).statusCode).toBe(401)
  })

  it('checks ownership: 200 owner, 403 someone else, 404 missing', async () => {
    expect((await get('/docs/doc-1', 'boss')).statusCode).toBe(200)

    const other = await get('/docs/doc-1', 'siti')
    expect(other.statusCode).toBe(403)
    expect(other.json().error.code).toBe('FORBIDDEN')

    const missing = await get('/docs/nope', 'boss')
    expect(missing.statusCode).toBe(404)
    expect(missing.json().error.code).toBe('DOC_NOT_FOUND')
  })
})
