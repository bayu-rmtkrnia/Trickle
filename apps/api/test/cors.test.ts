import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'
import type { Db } from '../src/lib/prisma.js'

describe('browser CORS preflight', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({
      env: loadEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://unused:unused@localhost/unused',
        CORS_ORIGINS: 'http://localhost:3000',
      }),
      // Preflight is handled before route authentication or database access.
      db: {} as Db,
      rateLimit: false,
    })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('exposes Retry-After so browser clients can honor rate-limit responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { origin: 'http://localhost:3000' },
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers['access-control-expose-headers']).toBe('Retry-After')
  })

  it.each([
    { method: 'DELETE', path: '/api/v1/sessions/current', headers: 'authorization' },
    { method: 'PATCH', path: '/api/v1/users/me', headers: 'authorization,content-type' },
  ])('allows $method $path from the frontend', async ({ method, path, headers }) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: path,
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': method,
        'access-control-request-headers': headers,
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    const allowedMethods = String(response.headers['access-control-allow-methods'])
      .split(',')
      .map((value) => value.trim())
    expect(allowedMethods).toContain(method)
    expect(response.headers['access-control-allow-headers']).toBe(headers)
  })
})
