/**
 * Generates postman/Trickle.postman_collection.json.
 * Folders follow the golden path, so "Run collection" top to bottom works
 * once {{employerToken}}, {{workerToken}} and {{familyToken}} are filled with
 * `pnpm session <role>` (Postman cannot log in to Privy).
 */
import { mkdirSync, writeFileSync } from 'node:fs'

type Auth = { type: 'noauth' } | { type: 'bearer'; bearer: unknown[] }

const noauth: Auth = { type: 'noauth' }
const bearer = (variable: string): Auth => ({
  type: 'bearer',
  bearer: [{ key: 'token', value: `{{${variable}}}`, type: 'string' }],
})
const status = (code: number) =>
  `pm.test('status ${code}', () => pm.response.to.have.status(${code}));`
const errCode = (code: string) =>
  `pm.test('error code ${code}', () => pm.expect(pm.response.json().error.code).to.eql('${code}'));`
const save = (variable: string, field: string) =>
  `pm.collectionVariables.set('${variable}', pm.response.json().${field});`

interface Opts {
  body?: unknown
  auth?: Auth
  tests?: string[]
  description?: string
}

function req(name: string, method: string, path: string, opts: Opts = {}) {
  const [p = '', q] = path.split('?')
  const url: Record<string, unknown> = {
    raw: `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: p.split('/').filter(Boolean),
  }
  if (q) {
    url.query = q.split('&').map((kv) => {
      const [key, value] = kv.split('=')
      return { key, value }
    })
  }
  const request: Record<string, unknown> = {
    method,
    header: opts.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url,
    auth: opts.auth ?? noauth,
  }
  if (opts.body) {
    request.body = {
      mode: 'raw',
      raw: JSON.stringify(opts.body, null, 2),
      options: { raw: { language: 'json' } },
    }
  }
  if (opts.description) request.description = opts.description
  return {
    name,
    request,
    event: opts.tests?.length
      ? [{ listen: 'test', script: { type: 'text/javascript', exec: opts.tests } }]
      : undefined,
  }
}

const collection = {
  info: {
    name: 'Trickle API',
    description:
      'Trickle API v1 (resource endpoints under /api/v1). Folders follow the golden path: employer invites worker, worker invites family. Set {{baseUrl}} to the deployed URL or http://localhost:4000.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'employerToken', value: '' },
    { key: 'workerToken', value: '' },
    { key: 'familyToken', value: '' },
    { key: 'workerInviteCode', value: '' },
    { key: 'familyInviteCode', value: '' },
    { key: 'privyAccessToken', value: '' },
  ],
  item: [
    {
      name: '1. System',
      item: [
        req('Health', 'GET', '/health', { tests: [status(200)] }),
        req('Unknown route (404)', 'GET', '/does-not-exist', {
          tests: [status(404), errCode('ROUTE_NOT_FOUND')],
        }),
      ],
    },
    {
      name: '2. Sessions & users',
      item: [
        req('Sign in with Privy', 'POST', '/api/v1/sessions', {
          body: { accessToken: '{{privyAccessToken}}' },
          description:
            'Set {{privyAccessToken}} to the value of `await getAccessToken()` in the web app (or the `privy:token` entry in its localStorage). For the role tokens below, run `pnpm session employer|worker|family` in apps/api instead.',
          tests: [status(201)],
        }),
        req('Sign in - invalid Privy token (401)', 'POST', '/api/v1/sessions', {
          body: { accessToken: 'not-a-privy-token' },
          description: 'Answers 503 PRIVY_NOT_CONFIGURED when the server has no PRIVY_APP_ID.',
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
        req('Sign in - missing token (422)', 'POST', '/api/v1/sessions', {
          body: {},
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
        req('Me', 'GET', '/api/v1/users/me', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Me - no token (401)', 'GET', '/api/v1/users/me', {
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
        req('Update me', 'PATCH', '/api/v1/users/me', {
          auth: bearer('workerToken'),
          body: { displayName: 'Siti Rahma' },
          tests: [status(200)],
        }),
        req('Update me - empty name (422)', 'PATCH', '/api/v1/users/me', {
          auth: bearer('workerToken'),
          body: { displayName: '' },
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
      ],
    },
    {
      name: '3. Employers',
      item: [
        req('Create employer', 'POST', '/api/v1/employers', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          tests: [status(201)],
        }),
        req('Create employer - duplicate (409)', 'POST', '/api/v1/employers', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          tests: [status(409), errCode('EMPLOYER_EXISTS')],
        }),
        req('Create employer - invalid (422)', 'POST', '/api/v1/employers', {
          auth: bearer('workerToken'),
          body: { name: 'A', country: 'Malaysia' },
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
        req('Get my employer', 'GET', '/api/v1/employers/me', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Get my employer - none (404)', 'GET', '/api/v1/employers/me', {
          auth: bearer('familyToken'),
          tests: [status(404), errCode('EMPLOYER_NOT_FOUND')],
        }),
        req('Update my employer', 'PATCH', '/api/v1/employers/me', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya Sdn Bhd' },
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '4. Invites',
      item: [
        req('Create worker invite', 'POST', '/api/v1/invites', {
          auth: bearer('employerToken'),
          body: { type: 'WORKER', inviteeName: 'Siti Rahma', monthlySalaryUsd: 1200 },
          tests: [status(201), save('workerInviteCode', 'code')],
        }),
        req('Create family invite - not a worker yet (403)', 'POST', '/api/v1/invites', {
          auth: bearer('workerToken'),
          body: { type: 'FAMILY', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get invite (public)', 'GET', '/api/v1/invites/{{workerInviteCode}}', {
          tests: [status(200)],
        }),
        req('Get invite - not found (404)', 'GET', '/api/v1/invites/ZZZZZZZZZZ', {
          tests: [status(404), errCode('INVITE_NOT_FOUND')],
        }),
        req('Accept own invite (400)', 'POST', '/api/v1/invites/{{workerInviteCode}}/accept', {
          auth: bearer('employerToken'),
          tests: [status(400), errCode('CANNOT_ACCEPT_OWN_INVITE')],
        }),
        req('Accept worker invite', 'POST', '/api/v1/invites/{{workerInviteCode}}/accept', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
        req(
          'Accept worker invite again (409)',
          'POST',
          '/api/v1/invites/{{workerInviteCode}}/accept',
          {
            auth: bearer('workerToken'),
            tests: [status(409), errCode('INVITE_ALREADY_ACCEPTED')],
          },
        ),
        req('Create family invite', 'POST', '/api/v1/invites', {
          auth: bearer('workerToken'),
          body: { type: 'FAMILY', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(201), save('familyInviteCode', 'code')],
        }),
        req('Accept family invite', 'POST', '/api/v1/invites/{{familyInviteCode}}/accept', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('List my invites', 'GET', '/api/v1/invites?type=WORKER&limit=10', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('List company workers', 'GET', '/api/v1/employers/me/workers', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Me (worker roles)', 'GET', '/api/v1/users/me', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '5. Gas',
      item: [
        req('Gas status', 'GET', '/api/v1/gas/status', { tests: [status(200)] }),
        req('Gas drip', 'POST', '/api/v1/gas/drip', {
          auth: bearer('familyToken'),
          description:
            '201 on the first call, 200 with alreadyDripped=true afterwards. 503 DRIP_UNAVAILABLE if no treasury key is configured.',
        }),
        req('Gas drip - again (idempotent)', 'POST', '/api/v1/gas/drip', {
          auth: bearer('familyToken'),
        }),
      ],
    },
    {
      name: '6. FX',
      item: [req('USD to IDR', 'GET', '/api/v1/fx/usd-idr', { tests: [status(200)] })],
    },
    {
      name: '7. Sign out',
      item: [
        req('Sign out', 'DELETE', '/api/v1/sessions/current', {
          auth: bearer('familyToken'),
          tests: [status(204)],
        }),
        req('Me after sign out (401)', 'GET', '/api/v1/users/me', {
          auth: bearer('familyToken'),
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
      ],
    },
  ],
}

const out = new URL('../postman/Trickle.postman_collection.json', import.meta.url)
mkdirSync(new URL('.', out), { recursive: true })
writeFileSync(out, JSON.stringify(collection, null, 2) + '\n')
console.log(`wrote ${out.pathname}`)
