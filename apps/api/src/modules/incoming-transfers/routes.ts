import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createIncomingTransferController } from './controller.js'
import { createIncomingTransferRepository } from './repository.js'
import { listIncomingTransfersSchema } from './schemas.js'
import { createIncomingTransferService } from './service.js'

const incomingTransfers: FastifyPluginAsyncZod = async (app) => {
  const controller = createIncomingTransferController(
    createIncomingTransferService({
      repo: createIncomingTransferRepository(app.db),
      splits: app.splits,
    }),
  )

  // No role check, like /users/me/streams: a removed family member still sees what they received.
  app.get(
    '/users/me/incoming-transfers',
    { onRequest: [app.authenticate], schema: listIncomingTransfersSchema },
    controller.listMine,
  )
}

export default incomingTransfers
