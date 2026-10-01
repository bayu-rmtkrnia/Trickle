/**
 * Generates postman/Trickle.postman_collection.json.
 * Folders follow the golden path, so "Run collection" top to bottom works
 * once the three Verify requests have bodies from `pnpm sign <role>`.
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

const verify = (who: string) =>
  req(`Verify (${who})`, 'POST', '/auth/verify', {
    body: { message: `paste from: pnpm sign ${who}`, signature: '0x...' },
    description: `Postman cannot sign messages. In apps/api run \`pnpm sign ${who}\` and paste the printed JSON as the body. The token is saved to {{${who}Token}}.`,
    tests: [status(200), save(`${who}Token`, 'token')],
  })

const collection = {
  info: {
    name: 'Trickle API',
    description:
      'Milestone 1 API. Folders follow the golden path: employer invites worker, worker invites family. Set {{baseUrl}} to the deployed URL or http://localhost:4000.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'employerToken', value: '' },
    { key: 'workerToken', value: '' },
    { key: 'familyToken', value: '' },
    { key: 'workerInviteCode', value: '' },
    { key: 'familyInviteCode', value: '' },
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
      name: '2. Auth',
      item: [
        req('Challenge', 'POST', '/auth/challenge', {
          body: { address: '0x66818500d7c295d61D613C55269089e0C3D73fCf' },
          tests: [status(201)],
        }),
        req('Challenge - invalid address (422)', 'POST', '/auth/challenge', {
          body: { address: '0x123' },
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
        verify('employer'),
        verify('worker'),
        verify('family'),
        req('Verify - replayed signature (401)', 'POST', '/auth/verify', {
          body: { message: 'paste a body that was already used', signature: '0x...' },
          description: 'Send the same body as an earlier successful verify. Nonces are single-use.',
          tests: [status(401)],
        }),
        req('Me', 'GET', '/auth/me', { auth: bearer('employerToken'), tests: [status(200)] }),
        req('Me - no token (401)', 'GET', '/auth/me', {
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
      ],
    },
    {
      name: '3. Employers',
      item: [
        req('Create employer', 'POST', '/employers', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          tests: [status(201)],
        }),
        req('Create employer - duplicate (409)', 'POST', '/employers', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          tests: [status(409), errCode('EMPLOYER_EXISTS')],
        }),
        req('Create employer - invalid (422)', 'POST', '/employers', {
          auth: bearer('workerToken'),
          body: { name: 'A', country: 'Malaysia' },
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
        req('Get my employer', 'GET', '/employers/me', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Get my employer - none (404)', 'GET', '/employers/me', {
          auth: bearer('familyToken'),
          tests: [status(404), errCode('EMPLOYER_NOT_FOUND')],
        }),
        req('Update my employer', 'PATCH', '/employers/me', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya Sdn Bhd' },
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '4. Invites',
      item: [
        req('Create worker invite', 'POST', '/invites', {
          auth: bearer('employerToken'),
          body: { type: 'WORKER', inviteeName: 'Siti Rahma', monthlySalaryUsd: 1200 },
          tests: [status(201), save('workerInviteCode', 'code')],
        }),
        req('Create family invite - not a worker yet (403)', 'POST', '/invites', {
          auth: bearer('workerToken'),
          body: { type: 'FAMILY', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get invite (public)', 'GET', '/invites/{{workerInviteCode}}', {
          tests: [status(200)],
        }),
        req('Get invite - not found (404)', 'GET', '/invites/ZZZZZZZZZZ', {
          tests: [status(404), errCode('INVITE_NOT_FOUND')],
        }),
        req('Accept own invite (400)', 'POST', '/invites/{{workerInviteCode}}/accept', {
          auth: bearer('employerToken'),
          tests: [status(400), errCode('CANNOT_ACCEPT_OWN_INVITE')],
        }),
        req('Accept worker invite', 'POST', '/invites/{{workerInviteCode}}/accept', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
        req('Accept worker invite again (409)', 'POST', '/invites/{{workerInviteCode}}/accept', {
          auth: bearer('workerToken'),
          tests: [status(409), errCode('INVITE_ALREADY_ACCEPTED')],
        }),
        req('Create family invite', 'POST', '/invites', {
          auth: bearer('workerToken'),
          body: { type: 'FAMILY', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(201), save('familyInviteCode', 'code')],
        }),
        req('Accept family invite', 'POST', '/invites/{{familyInviteCode}}/accept', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('List my invites', 'GET', '/invites?type=WORKER', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('List company workers', 'GET', '/employers/me/workers', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Me (worker roles)', 'GET', '/auth/me', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '5. Gas',
      item: [
        req('Gas status', 'GET', '/gas/status', { tests: [status(200)] }),
        req('Gas drip', 'POST', '/gas/drip', {
          auth: bearer('familyToken'),
          description:
            '201 on the first call, 200 with alreadyDripped=true afterwards. 503 DRIP_UNAVAILABLE if no treasury key is configured.',
        }),
        req('Gas drip - again (idempotent)', 'POST', '/gas/drip', {
          auth: bearer('familyToken'),
        }),
      ],
    },
    {
      name: '6. FX',
      item: [req('USD to IDR', 'GET', '/fx/usd-idr', { tests: [status(200)] })],
    },
  ],
}

const out = new URL('../postman/Trickle.postman_collection.json', import.meta.url)
mkdirSync(new URL('.', out), { recursive: true })
writeFileSync(out, JSON.stringify(collection, null, 2) + '\n')
console.log(`wrote ${out.pathname}`)
