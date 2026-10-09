import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { ApiError, createApiClient } from '../lib/api'

let baseUrl: string
let requests = 0
const server = createServer(async (req, res) => {
  requests++
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  res.setHeader('Content-Type', 'application/json')
  if (req.url === '/api/v1/invalid') {
    res.statusCode = 422
    res.end(
      JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'body.name: too short',
          details: [{ field: 'body.name', message: 'too short' }],
        },
      }),
    )
  } else if (req.url === '/api/v1/missing') {
    res.statusCode = 404
    res.end(JSON.stringify({ error: { code: 'INVITE_NOT_FOUND', message: 'Invalid link' } }))
  } else if (req.url === '/api/v1/proxy-error') {
    res.statusCode = 502
    res.end('<html>gateway failed</html>')
  } else if (req.url === '/api/v1/broken') {
    res.end('not JSON')
  } else if (req.url === '/api/v1/empty') {
    res.statusCode = 204
    res.end()
  } else {
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization ?? null,
        contentType: req.headers['content-type'] ?? null,
        body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null,
      }),
    )
  }
})

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}/`
})
after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test('client prefixes business paths and sends JSON bodies', async () => {
  const result = await createApiClient({ baseUrl }).request('/employers', {
    method: 'POST',
    body: { name: 'Company' },
    query: { cursor: 'a+/=?', limit: 2, absent: undefined },
  })
  assert.deepEqual(result, {
    method: 'POST',
    url: '/api/v1/employers?cursor=a%2B%2F%3D%3F&limit=2',
    authorization: null,
    contentType: 'application/json',
    body: { name: 'Company' },
  })
})

test('422 preserves backend details and exposes safe field errors', async () => {
  await assert.rejects(createApiClient({ baseUrl }).request('/invalid'), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 422)
    assert.equal(error.code, 'VALIDATION_ERROR')
    assert.equal(error.message, 'body.name: too short')
    assert.deepEqual(error.details, [{ field: 'body.name', message: 'too short' }])
    assert.deepEqual(error.validationErrors, [{ field: 'body.name', message: 'too short' }])
    return true
  })
})

test('HTTP failures preserve backend codes and status', async () => {
  await assert.rejects(createApiClient({ baseUrl }).request('/missing'), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 404)
    assert.equal(error.code, 'INVITE_NOT_FOUND')
    assert.deepEqual(error.validationErrors, [])
    return true
  })
})

test('non-JSON error keeps HTTP status without exposing HTML', async () => {
  await assert.rejects(createApiClient({ baseUrl }).request('/proxy-error'), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 502)
    assert.equal(error.code, 'HTTP_ERROR')
    assert.ok(!error.message.includes('<html>'))
    return true
  })
})

test('invalid successful JSON is rejected instead of returning fabricated data', async () => {
  await assert.rejects(createApiClient({ baseUrl }).request('/broken'), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 200)
    assert.equal(error.code, 'INVALID_RESPONSE')
    return true
  })
  assert.equal(await createApiClient({ baseUrl }).request<void>('/empty'), undefined)
})

test('protected requests without auth configuration never reach the backend', async () => {
  const count = requests
  await assert.rejects(
    createApiClient({ baseUrl }).request('/employers/me', { auth: true }),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'AUTH_NOT_CONFIGURED' && error.status === null,
  )
  assert.equal(requests, count)
})

test('future token getter is refreshed per protected call but unused for public calls', async () => {
  let tokenCalls = 0
  const client = createApiClient({
    baseUrl,
    getAccessToken: async () => `test-token-${++tokenCalls}`,
  })
  const first = await client.request<{ authorization: string }>('/employers/me', { auth: true })
  const second = await client.request<{ authorization: string }>('/employers/me', { auth: true })
  assert.equal(first.authorization, 'Bearer test-token-1')
  assert.equal(second.authorization, 'Bearer test-token-2')
  const publicResult = await client.request<{ authorization: null }>('/fx/usd-idr')
  assert.equal(publicResult.authorization, null)
  assert.equal(tokenCalls, 2)
})

test('null access token rejects protected request before sending it', async () => {
  const count = requests
  const client = createApiClient({ baseUrl, getAccessToken: async () => null })
  await assert.rejects(
    client.request('/employers/me', { auth: true }),
    (error: unknown) => error instanceof ApiError && error.code === 'AUTH_REQUIRED',
  )
  assert.equal(requests, count)
})

test('cancellation propagates AbortError rather than an HTTP/auth error', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(
    createApiClient({ baseUrl }).request('/anything', { signal: controller.signal }),
    (error: unknown) => error instanceof Error && error.name === 'AbortError',
  )
})

test('network failures expose a distinguishable error without HTTP status', async () => {
  const unreachable = createServer()
  await new Promise<void>((resolve) => unreachable.listen(0, '127.0.0.1', resolve))
  const address = unreachable.address()
  assert.ok(address && typeof address !== 'string')
  await new Promise<void>((resolve) => unreachable.close(() => resolve()))
  await assert.rejects(
    createApiClient({ baseUrl: `http://127.0.0.1:${address.port}` }).request('/anything'),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'NETWORK_ERROR' && error.status === null,
  )
})

test('misconfigured base URLs fail locally rather than fetching the wrong resource', async () => {
  const count = requests
  for (const suffix of ['?existing=query', '#fragment']) {
    await assert.rejects(
      createApiClient({ baseUrl: baseUrl + suffix }).request('/anything'),
      (error: unknown) => error instanceof ApiError && error.code === 'API_CONFIG_ERROR',
    )
  }
  assert.equal(requests, count)
})
