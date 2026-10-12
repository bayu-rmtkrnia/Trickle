import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createFieldCipher } from '../../lib/crypto.js'
import { badRequest } from '../../lib/errors.js'
import { idParam } from '../../lib/http.js'
import { createPayoutController } from './controller.js'
import { createPayoutRepository } from './repository.js'
import {
  createPayoutSchema,
  getPayoutSchema,
  listPayoutsSchema,
  payoutWebhookSchema,
} from './schemas.js'
import { createPayoutService, payoutNotFound } from './service.js'

const payouts: FastifyPluginAsyncZod = async (app) => {
  const repo = createPayoutRepository(app.db)
  const key = app.env.BANK_ENCRYPTION_KEY
  const controller = createPayoutController(
    createPayoutService({
      repo,
      transfers: app.transfers,
      provider: app.payoutProvider,
      fx: app.fx,
      cipher: key ? createFieldCipher(key) : undefined,
      webhookSecret: app.env.PAYOUT_WEBHOOK_SECRET,
    }),
  )
  // Recipients cash out (PLAN §6.3 "R pemilik"), like /bank-accounts.
  const recipient = [app.authenticate, app.requireRole('recipient')]

  app.post('/payouts', { onRequest: recipient, schema: createPayoutSchema }, controller.create)
  app.get('/payouts', { onRequest: recipient, schema: listPayoutsSchema }, controller.list)
  app.get(
    '/payouts/:id',
    {
      onRequest: recipient,
      preHandler: [app.requireOwnership((req) => repo.findOwnerId(idParam(req)), payoutNotFound)],
      schema: getPayoutSchema,
    },
    controller.get,
  )

  // The webhook signs the exact bytes it sent, so this scope keeps the raw body.
  await app.register(async (hooks) => {
    hooks.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
      req.rawBody = body as string
      try {
        done(null, JSON.parse(body as string))
      } catch {
        done(badRequest('MALFORMED_REQUEST', 'Body is not valid JSON'))
      }
    })
    hooks.post(
      '/webhooks/payout-provider',
      { preValidation: [controller.verifyWebhook], schema: payoutWebhookSchema },
      controller.webhook,
    )
  })
}

export default payouts
