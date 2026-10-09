import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { ApiError, createApiClient } from '../lib/api'
import { createEmployer, getEmployer, updateEmployer } from '../services/employers'
import { getUsdIdrRate } from '../services/fx'
import { acceptInvite, createInvite, getInvite, listInvites } from '../services/invites'
import { listWorkers } from '../services/workers'

let baseUrl: string
const requests: { method: string; url: string; body: unknown; authorization: string | null }[] = []
const invite = {
  code: 'ABCDEF',
  type: 'FAMILY',
  status: 'PENDING',
  inviteeName: 'Recipient',
  monthlySalaryUsd: null,
  relation: null,
  invitedBy: { name: null, address: '0x123' },
  url: 'http://localhost:3000/f/invite/ABCDEF',
  expiresAt: '2026-10-17T00:00:00.000Z',
  acceptedAt: null,
  createdAt: '2026-10-03T00:00:00.000Z',
}
const fx = {
  base: 'USD',
  quote: 'IDR',
  rate: 16500,
  source: 'fallback',
  rateTime: null,
  fetchedAt: null,
}
const employer = {
  id: 'employer-1',
  name: 'Company',
  country: null,
  ownerAddress: '0x123',
  createdAt: '2026-10-03T00:00:00.000Z',
}
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  requests.push({
    method: req.method!,
    url: req.url!,
    body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null,
    authorization: req.headers.authorization ?? null,
  })
  const url = new URL(req.url!, 'http://localhost')
  let body: unknown
  if (url.pathname === '/api/v1/fx/usd-idr') body = fx
  else if (url.pathname === '/api/v1/invites' && req.method === 'GET')
    body = { data: [invite], nextCursor: 'cursor+/=' }
  else if (url.pathname === '/api/v1/employers/me/workers') body = { data: [], nextCursor: null }
  else if (url.pathname.includes('/invites')) body = invite
  else body = employer
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
})
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  baseUrl = `http://127.0.0.1:${address.port}`
})
after(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  )
})

test('public services preserve nullable fields and never send authorization', async () => {
  const client = createApiClient({ baseUrl })
  assert.deepEqual(await getInvite('ABC/DEF?#', client), invite)
  assert.deepEqual(await getUsdIdrRate(client), fx)
  assert.deepEqual(requests.slice(-2), [
    { method: 'GET', url: '/api/v1/invites/ABC%2FDEF%3F%23', body: null, authorization: null },
    { method: 'GET', url: '/api/v1/fx/usd-idr', body: null, authorization: null },
  ])
})

test('all protected services are blocked by default without any HTTP request', async () => {
  const count = requests.length
  const calls = [
    () => getEmployer(),
    () => createEmployer({ name: 'Company' }),
    () => updateEmployer({ country: 'ID' }),
    () => listWorkers(),
    () => listInvites(),
    () => createInvite({ type: 'FAMILY', inviteeName: 'Recipient' }),
    () => acceptInvite('ABCDEF'),
  ]
  for (const call of calls) {
    await assert.rejects(
      call(),
      (error: unknown) => error instanceof ApiError && error.code === 'AUTH_NOT_CONFIGURED',
    )
  }
  assert.equal(requests.length, count)
})

test('prepared services follow current endpoint methods, inputs and cursor responses', async () => {
  // Only this disposable test server accepts the token. This is NOT a backend Privy test.
  const client = createApiClient({ baseUrl, getAccessToken: async () => 'test-only-token' })
  const start = requests.length
  assert.deepEqual(await createEmployer({ name: 'Company', country: 'ID' }, client), employer)
  assert.deepEqual(await getEmployer(client), employer)
  assert.deepEqual(await updateEmployer({ name: 'Updated' }, client), employer)
  const first = await listInvites({ type: 'FAMILY', limit: 2 }, client)
  assert.deepEqual(first, { data: [invite], nextCursor: 'cursor+/=' })
  await listInvites({ cursor: first.nextCursor! }, client)
  assert.deepEqual(await listWorkers({ cursor: 'worker+/=', limit: 1 }, client), {
    data: [],
    nextCursor: null,
  })
  await createInvite({ type: 'WORKER', inviteeName: 'Worker', monthlySalaryUsd: 100 }, client)
  await createInvite({ type: 'FAMILY', inviteeName: 'Recipient', relation: 'Ibu' }, client)
  await acceptInvite('ABC/DEF', client)
  assert.deepEqual(
    requests.slice(start).map(({ method, url, body }) => ({ method, url, body })),
    [
      { method: 'POST', url: '/api/v1/employers', body: { name: 'Company', country: 'ID' } },
      { method: 'GET', url: '/api/v1/employers/me', body: null },
      { method: 'PATCH', url: '/api/v1/employers/me', body: { name: 'Updated' } },
      { method: 'GET', url: '/api/v1/invites?type=FAMILY&limit=2', body: null },
      { method: 'GET', url: '/api/v1/invites?cursor=cursor%2B%2F%3D', body: null },
      {
        method: 'GET',
        url: '/api/v1/employers/me/workers?cursor=worker%2B%2F%3D&limit=1',
        body: null,
      },
      {
        method: 'POST',
        url: '/api/v1/invites',
        body: { type: 'WORKER', inviteeName: 'Worker', monthlySalaryUsd: 100 },
      },
      {
        method: 'POST',
        url: '/api/v1/invites',
        body: { type: 'FAMILY', inviteeName: 'Recipient', relation: 'Ibu' },
      },
      { method: 'POST', url: '/api/v1/invites/ABC%2FDEF/accept', body: null },
    ],
  )
})
