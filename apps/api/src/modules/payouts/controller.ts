import type { FastifyRequest } from 'fastify'
import type { Handler } from '../../lib/http.js'
import type {
  createPayoutSchema,
  getPayoutSchema,
  listPayoutsSchema,
  payoutWebhookSchema,
} from './schemas.js'
import type { PayoutService } from './service.js'

export function createPayoutController(service: PayoutService) {
  const create: Handler<typeof createPayoutSchema> = async (req, reply) => {
    const user = { id: req.user.sub, address: req.user.address }
    const result = await service.create(user, req.body, req.log)
    return reply.code(result.created ? 201 : 200).send(result.payout)
  }

  const list: Handler<typeof listPayoutsSchema> = async (req) =>
    service.list(req.user.sub, req.query)

  const get: Handler<typeof getPayoutSchema> = async (req) => service.get(req.params.id, req.log)

  /** preValidation: an unsigned request is refused before its body is even looked at. */
  const verifyWebhook = async (req: FastifyRequest) => {
    service.verifyWebhook(
      req.rawBody,
      req.headers['x-payout-timestamp'],
      req.headers['x-payout-signature'],
    )
  }

  const webhook: Handler<typeof payoutWebhookSchema> = async (req) => {
    await service.applyWebhook(req.body)
    return { received: true as const }
  }

  return { create, list, get, verifyWebhook, webhook }
}
