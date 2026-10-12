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
  /** Runs before the request, e.g. to sign it. */
  prerequest?: string[]
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
  const event = [
    ...(opts.prerequest?.length
      ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: opts.prerequest } }]
      : []),
    ...(opts.tests?.length
      ? [{ listen: 'test', script: { type: 'text/javascript', exec: opts.tests } }]
      : []),
  ]
  return { name, request, event: event.length ? event : undefined }
}

/** Signs the raw body like the payout provider does (see POST /webhooks/payout-provider). */
const signPayoutWebhook = [
  'const ts = Math.floor(Date.now() / 1000).toString();',
  'const body = pm.request.body.raw;',
  "const secret = pm.collectionVariables.get('payoutWebhookSecret');",
  "const sig = CryptoJS.HmacSHA256(ts + '.' + body, secret).toString(CryptoJS.enc.Hex);",
  "pm.request.headers.upsert({ key: 'x-payout-timestamp', value: ts });",
  "pm.request.headers.upsert({ key: 'x-payout-signature', value: 'sha256=' + sig });",
]

const collection = {
  info: {
    name: 'Trickle API',
    description:
      'Trickle API v1 (resource endpoints under /api/v1). Folders follow the golden path: employer invites worker, worker invites recipient. Set {{baseUrl}} to the deployed URL or http://localhost:4000.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'employerToken', value: '' },
    { key: 'workerToken', value: '' },
    { key: 'familyToken', value: '' },
    { key: 'companyId', value: '' },
    { key: 'workerId', value: '' },
    { key: 'extraWorkerId', value: '' },
    { key: 'recipientId', value: '' },
    { key: 'extraRecipientId', value: '' },
    { key: 'workerInviteCode', value: '' },
    { key: 'familyInviteCode', value: '' },
    { key: 'cancelInviteId', value: '' },
    { key: 'bankAccountId', value: '' },
    { key: 'payoutTxHash', value: '' },
    { key: 'payoutId', value: '' },
    { key: 'payoutRef', value: '' },
    { key: 'payoutWebhookSecret', value: '' },
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
      name: '3. Companies',
      item: [
        req('Create company', 'POST', '/api/v1/companies', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          description:
            '409 COMPANY_EXISTS if this account already has a company (e.g. a second run).',
          tests: [status(201)],
        }),
        req('Create company - duplicate (409)', 'POST', '/api/v1/companies', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya', country: 'MY' },
          tests: [status(409), errCode('COMPANY_EXISTS')],
        }),
        req('Create company - invalid (422)', 'POST', '/api/v1/companies', {
          auth: bearer('workerToken'),
          body: { name: 'A', country: 'Malaysia' },
          tests: [status(422), errCode('VALIDATION_ERROR')],
        }),
        req('Me (my company id)', 'GET', '/api/v1/users/me', {
          auth: bearer('employerToken'),
          description: 'Saves companyId for the requests below.',
          tests: [status(200), save('companyId', 'companyId')],
        }),
        req('Get company', 'GET', '/api/v1/companies/{{companyId}}', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Get company - not an employer (403)', 'GET', '/api/v1/companies/{{companyId}}', {
          auth: bearer('familyToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get company - unknown id (404)', 'GET', '/api/v1/companies/does-not-exist', {
          auth: bearer('employerToken'),
          tests: [status(404), errCode('COMPANY_NOT_FOUND')],
        }),
        req('Update company', 'PATCH', '/api/v1/companies/{{companyId}}', {
          auth: bearer('employerToken'),
          body: { name: 'PT Maju Jaya Sdn Bhd' },
          tests: [status(200)],
        }),
        req('Update company - not an employer (403)', 'PATCH', '/api/v1/companies/{{companyId}}', {
          auth: bearer('familyToken'),
          body: { name: 'Hijacked' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Delete company - not an employer (403)', 'DELETE', '/api/v1/companies/{{companyId}}', {
          auth: bearer('workerToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req(
          'List company workers - not an employer (403)',
          'GET',
          '/api/v1/companies/{{companyId}}/workers',
          {
            auth: bearer('workerToken'),
            tests: [status(403), errCode('FORBIDDEN')],
          },
        ),
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
        req('Create recipient invite - not a worker yet (403)', 'POST', '/api/v1/invites', {
          auth: bearer('workerToken'),
          body: { type: 'RECIPIENT', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get invite (public)', 'GET', '/api/v1/invites/{{workerInviteCode}}', {
          tests: [status(200)],
        }),
        req('Get invite - not found (404)', 'GET', '/api/v1/invites/ZZZZZZZZZZ', {
          tests: [status(404), errCode('INVITE_NOT_FOUND')],
        }),
        req('Accept own invite (400)', 'POST', '/api/v1/invites/{{workerInviteCode}}/acceptance', {
          auth: bearer('employerToken'),
          tests: [status(400), errCode('CANNOT_ACCEPT_OWN_INVITE')],
        }),
        req('Accept worker invite', 'POST', '/api/v1/invites/{{workerInviteCode}}/acceptance', {
          auth: bearer('workerToken'),
          tests: [status(201)],
        }),
        req(
          'Accept worker invite again (409)',
          'POST',
          '/api/v1/invites/{{workerInviteCode}}/acceptance',
          {
            auth: bearer('workerToken'),
            tests: [status(409), errCode('INVITE_ALREADY_ACCEPTED')],
          },
        ),
        req('Create recipient invite', 'POST', '/api/v1/invites', {
          auth: bearer('workerToken'),
          body: { type: 'RECIPIENT', inviteeName: 'Ibu Aminah', relation: 'Ibu' },
          tests: [status(201), save('familyInviteCode', 'code')],
        }),
        req('Accept recipient invite', 'POST', '/api/v1/invites/{{familyInviteCode}}/acceptance', {
          auth: bearer('familyToken'),
          tests: [status(201)],
        }),
        req('List my invites', 'GET', '/api/v1/invites?type=WORKER&limit=10', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Create invite to cancel', 'POST', '/api/v1/invites', {
          auth: bearer('employerToken'),
          body: { type: 'WORKER', inviteeName: 'Budi', monthlySalaryUsd: 900 },
          tests: [status(201), save('cancelInviteId', 'id')],
        }),
        req(
          'Cancel invite - not the creator (403)',
          'DELETE',
          '/api/v1/invites/{{cancelInviteId}}',
          {
            auth: bearer('workerToken'),
            tests: [status(403), errCode('FORBIDDEN')],
          },
        ),
        req('Cancel invite', 'DELETE', '/api/v1/invites/{{cancelInviteId}}', {
          auth: bearer('employerToken'),
          description: 'Cancelling twice is fine. 409 INVITE_ALREADY_ACCEPTED once it was used.',
          tests: [status(204)],
        }),
        req('List company workers', 'GET', '/api/v1/companies/{{companyId}}/workers', {
          auth: bearer('employerToken'),
          description: 'Saves the first worker as workerId for the Workers folder.',
          tests: [status(200), save('workerId', 'data[0].id')],
        }),
        req(
          'Delete company - still has workers (409)',
          'DELETE',
          '/api/v1/companies/{{companyId}}',
          {
            auth: bearer('employerToken'),
            tests: [status(409), errCode('COMPANY_HAS_WORKERS')],
          },
        ),
        req('Me (worker roles)', 'GET', '/api/v1/users/me', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '5. Workers',
      item: [
        req('Get worker (employer)', 'GET', '/api/v1/workers/{{workerId}}', {
          auth: bearer('employerToken'),
          tests: [status(200)],
        }),
        req('Get worker (the worker themself)', 'GET', '/api/v1/workers/{{workerId}}', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
        req('Get worker - family (403)', 'GET', '/api/v1/workers/{{workerId}}', {
          auth: bearer('familyToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get worker - unknown id (404)', 'GET', '/api/v1/workers/does-not-exist', {
          auth: bearer('employerToken'),
          tests: [status(404), errCode('WORKER_NOT_FOUND')],
        }),
        req('Update worker', 'PATCH', '/api/v1/workers/{{workerId}}', {
          auth: bearer('employerToken'),
          body: { position: 'Caregiver', monthlySalaryUsd: 1250 },
          tests: [status(200)],
        }),
        req('Update worker - the worker themself (403)', 'PATCH', '/api/v1/workers/{{workerId}}', {
          auth: bearer('workerToken'),
          body: { monthlySalaryUsd: 99999 },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Delete worker - the worker themself (403)', 'DELETE', '/api/v1/workers/{{workerId}}', {
          auth: bearer('workerToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Add worker by address', 'POST', '/api/v1/companies/{{companyId}}/workers', {
          auth: bearer('employerToken'),
          body: {
            address: '0x000000000000000000000000000000000000bEEF',
            displayName: 'Budi',
            position: 'Driver',
            monthlySalaryUsd: 900,
          },
          description:
            'Creates the account for this address if needed; it links when that wallet signs in with Privy. Re-running restores the worker after the delete below.',
          tests: [status(201), save('extraWorkerId', 'id')],
        }),
        req(
          'Add worker - already works here (409)',
          'POST',
          '/api/v1/companies/{{companyId}}/workers',
          {
            auth: bearer('employerToken'),
            body: {
              address: '0x000000000000000000000000000000000000bEEF',
              displayName: 'Budi',
              monthlySalaryUsd: 900,
            },
            tests: [status(409), errCode('WORKER_EXISTS')],
          },
        ),
        req('Delete worker', 'DELETE', '/api/v1/workers/{{extraWorkerId}}', {
          auth: bearer('employerToken'),
          description:
            '409 STREAM_ACTIVE when the employer still streams to this worker. The stream check is a placeholder until the indexer exists.',
          tests: [status(204)],
        }),
      ],
    },
    {
      name: '6. Recipients',
      item: [
        req('List my recipients', 'GET', '/api/v1/recipients', {
          auth: bearer('workerToken'),
          description: 'Saves the recipient from the family invite as recipientId.',
          tests: [status(200), save('recipientId', 'data[0].id')],
        }),
        req('List recipients - not a worker (403)', 'GET', '/api/v1/recipients', {
          auth: bearer('employerToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Get recipient (worker)', 'GET', '/api/v1/recipients/{{recipientId}}', {
          auth: bearer('workerToken'),
          tests: [status(200)],
        }),
        req('Get recipient (the recipient themself)', 'GET', '/api/v1/recipients/{{recipientId}}', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('Get recipient - employer (403)', 'GET', '/api/v1/recipients/{{recipientId}}', {
          auth: bearer('employerToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Update recipient', 'PATCH', '/api/v1/recipients/{{recipientId}}', {
          auth: bearer('workerToken'),
          body: { displayName: 'Mama', relation: 'Ibu' },
          tests: [status(200)],
        }),
        req(
          'Update recipient - the recipient themself (403)',
          'PATCH',
          '/api/v1/recipients/{{recipientId}}',
          {
            auth: bearer('familyToken'),
            body: { displayName: 'Hijacked' },
            tests: [status(403), errCode('FORBIDDEN')],
          },
        ),
        req('Add recipient by address', 'POST', '/api/v1/recipients', {
          auth: bearer('workerToken'),
          body: {
            address: '0x000000000000000000000000000000000000cAFE',
            displayName: 'Rina',
            relation: 'Istri',
          },
          description:
            'Creates the account for this address if needed; it links when that wallet signs in with Privy. Re-running restores the recipient after the delete below.',
          tests: [status(201), save('extraRecipientId', 'id')],
        }),
        req('Add recipient - already added (409)', 'POST', '/api/v1/recipients', {
          auth: bearer('workerToken'),
          body: { address: '0x000000000000000000000000000000000000cAFE', displayName: 'Rina' },
          tests: [status(409), errCode('RECIPIENT_EXISTS')],
        }),
        req('Delete recipient', 'DELETE', '/api/v1/recipients/{{extraRecipientId}}', {
          auth: bearer('workerToken'),
          description:
            "409 SPLIT_ACTIVE while the worker's on-chain split (splitBpsOf) still sends to this recipient.",
          tests: [status(204)],
        }),
      ],
    },
    {
      name: '6b. Bank accounts',
      item: [
        req('Add bank account', 'POST', '/api/v1/bank-accounts', {
          auth: bearer('familyToken'),
          description:
            'Recipient only. The number is encrypted at rest; responses only carry accountNumberLast4. 503 BANK_ACCOUNTS_UNAVAILABLE without BANK_ENCRYPTION_KEY.',
          body: {
            bankCode: 'BCA',
            accountNumber: '1234567890',
            accountName: 'Ibu Aminah',
            label: 'Rekening utama',
          },
          tests: [status(201), save('bankAccountId', 'id')],
        }),
        req('Add bank account - duplicate (409)', 'POST', '/api/v1/bank-accounts', {
          auth: bearer('familyToken'),
          body: { bankCode: 'BCA', accountNumber: '1234 5678 90', accountName: 'Ibu Aminah' },
          tests: [status(409), errCode('BANK_ACCOUNT_EXISTS')],
        }),
        req('Add bank account - not a recipient (403)', 'POST', '/api/v1/bank-accounts', {
          auth: bearer('employerToken'),
          body: { bankCode: 'BNI', accountNumber: '9876543210', accountName: 'Budi' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('List my bank accounts', 'GET', '/api/v1/bank-accounts', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('Get bank account', 'GET', '/api/v1/bank-accounts/{{bankAccountId}}', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('Get bank account - worker (403)', 'GET', '/api/v1/bank-accounts/{{bankAccountId}}', {
          auth: bearer('workerToken'),
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('Rename bank account', 'PATCH', '/api/v1/bank-accounts/{{bankAccountId}}', {
          auth: bearer('familyToken'),
          body: { label: 'Tabungan' },
          tests: [status(200)],
        }),
        req('Remove bank account', 'DELETE', '/api/v1/bank-accounts/{{bankAccountId}}', {
          auth: bearer('familyToken'),
          tests: [status(204)],
        }),
      ],
    },
    {
      name: '6c. Payouts',
      description:
        'Needs a real transfer first: from the recipient account, send mock AUSD to PAYOUT_ADDRESS on Monad testnet, then put the tx hash in {{payoutTxHash}} and an active bank account id in {{bankAccountId}}. The mock provider completes after MOCK_PAYOUT_SECONDS; account numbers ending in 0000 fail.',
      item: [
        req('Cash out', 'POST', '/api/v1/payouts', {
          auth: bearer('familyToken'),
          body: { txHash: '{{payoutTxHash}}', bankAccountId: '{{bankAccountId}}' },
          description:
            '201 the first time, 200 when the same hash is sent again. 409 TX_PENDING if not mined yet, 400 TX_NOT_A_PAYOUT if it did not pay the payout address.',
          tests: [
            "pm.test('created or replayed', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));",
            save('payoutId', 'id'),
            save('payoutRef', 'providerRef'),
          ],
        }),
        req('Cash out - not a recipient (403)', 'POST', '/api/v1/payouts', {
          auth: bearer('employerToken'),
          body: { txHash: '0x' + '0'.repeat(64), bankAccountId: 'x' },
          tests: [status(403), errCode('FORBIDDEN')],
        }),
        req('List my payouts', 'GET', '/api/v1/payouts', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('Get payout (refreshes status)', 'GET', '/api/v1/payouts/{{payoutId}}', {
          auth: bearer('familyToken'),
          tests: [status(200)],
        }),
        req('Provider webhook - unsigned (401)', 'POST', '/api/v1/webhooks/payout-provider', {
          body: { providerRef: '{{payoutRef}}', status: 'COMPLETED' },
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
        req('Provider webhook - signed', 'POST', '/api/v1/webhooks/payout-provider', {
          body: { providerRef: '{{payoutRef}}', status: 'COMPLETED' },
          prerequest: signPayoutWebhook,
          description:
            'Signed in the pre-request script with {{payoutWebhookSecret}} (= PAYOUT_WEBHOOK_SECRET). A finished payout keeps its status.',
          tests: [status(200)],
        }),
      ],
    },
    {
      name: '7. Gas',
      item: [
        req('Gas status', 'GET', '/api/v1/gas-drips/status', { tests: [status(200)] }),
        req('Gas drip', 'POST', '/api/v1/gas-drips', {
          auth: bearer('familyToken'),
          description:
            '201 on the first call, 200 with alreadyDripped=true afterwards. 503 DRIP_UNAVAILABLE (no treasury key) or DRIP_TREASURY_EMPTY, 429 DRIP_IP_LIMIT / DRIP_DAILY_LIMIT. Old path POST /gas/drip still works (deprecated).',
        }),
        req('Gas drip - again (idempotent)', 'POST', '/api/v1/gas-drips', {
          auth: bearer('familyToken'),
        }),
      ],
    },
    {
      name: '7b. Judge mode',
      item: [
        req('Demo status', 'GET', '/api/v1/demo-streams/status', { tests: [status(200)] }),
        req('Start demo stream', 'POST', '/api/v1/demo-streams', {
          auth: bearer('familyToken'),
          description:
            'Real testnet stream from the demo employer to the signed-in account, no role needed. 201 the first time, 200 with alreadyStarted=true afterwards. 503 DEMO_UNAVAILABLE without DEMO_EMPLOYER_PRIVATE_KEY, 429 DEMO_IP_LIMIT / DEMO_DAILY_LIMIT.',
        }),
        req('Start demo stream - again (idempotent)', 'POST', '/api/v1/demo-streams', {
          auth: bearer('familyToken'),
        }),
      ],
    },
    {
      name: '8. FX',
      item: [
        req('USD to IDR', 'GET', '/api/v1/fx-rates/usd-idr', {
          auth: bearer('familyToken'),
          description:
            'Any signed-in account. The old public path GET /fx/usd-idr still works (deprecated).',
          tests: [status(200)],
        }),
        req('USD to IDR - signed out (401)', 'GET', '/api/v1/fx-rates/usd-idr', {
          tests: [status(401), errCode('UNAUTHORIZED')],
        }),
      ],
    },
    {
      name: '9. Sign out',
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
