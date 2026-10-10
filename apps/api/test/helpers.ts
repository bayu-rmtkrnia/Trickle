import type { FastifyInstance, InjectOptions } from 'fastify'
import { expect } from 'vitest'

/**
 * Asserts that every request answers 403 FORBIDDEN for `token`. Use it to prove
 * that a sensitive endpoint rejects the other roles (rubric K5):
 *
 *   await expectForbidden(app, worker.token, [
 *     { method: 'PATCH', url: `/api/v1/companies/${id}`, payload: { name: 'X' } },
 *   ])
 */
export async function expectForbidden(
  app: FastifyInstance,
  token: string,
  requests: InjectOptions[],
) {
  for (const r of requests) {
    const res = await app.inject({
      ...r,
      headers: { ...r.headers, authorization: `Bearer ${token}` },
    })
    const label = `${r.method} ${r.url}`
    expect(res.statusCode, label).toBe(403)
    expect(res.json().error.code, label).toBe('FORBIDDEN')
  }
}
