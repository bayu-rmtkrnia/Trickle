import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'

// These requests fail before any query runs, so no database is needed.
describe('error responses', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
    JWT_SECRET: 'test-secret-test-secret-test-secret',
  })
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ env, rateLimit: false })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('returns 422 with field details when the body fails validation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/challenge',
      payload: { address: 'nope' },
    })
    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('body.address'),
        details: [{ field: 'body.address', message: expect.any(String) }],
      },
    })
  })

  it('returns 400 when the body is not valid JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/challenge',
      headers: { 'content-type': 'application/json' },
      payload: '{"address":',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('MALFORMED_REQUEST')
  })

  it('returns 401 in the envelope when the session is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    })
  })

  it('returns 404 in the envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/does-not-exist?x=1' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'No route for GET /does-not-exist' },
    })
  })

  it('serves resource routes only under /api/v1', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('ROUTE_NOT_FOUND')
  })
})
