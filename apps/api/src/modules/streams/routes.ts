import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { idParam } from '../../lib/http.js'
import { companyNotFound } from '../companies/service.js'
import { createStreamController } from './controller.js'
import { createStreamRepository } from './repository.js'
import { listCompanyStreamsSchema, listMyStreamsSchema } from './schemas.js'
import { createStreamService } from './service.js'

const streams: FastifyPluginAsyncZod = async (app) => {
  const repo = createStreamRepository(app.db)
  const controller = createStreamController(createStreamService({ repo, streams: app.streams }))

  app.get(
    '/companies/:id/streams',
    {
      onRequest: [app.authenticate, app.requireRole('employer')],
      preHandler: [
        app.requireOwnership(
          async (req) => (await repo.findCompanyOwner(idParam(req)))?.ownerId ?? null,
          companyNotFound,
        ),
      ],
      schema: listCompanyStreamsSchema,
    },
    controller.listForCompany,
  )

  // No role check, like /users/me/employments: judge-mode streams pay accounts with no Worker row.
  app.get(
    '/users/me/streams',
    { onRequest: [app.authenticate], schema: listMyStreamsSchema },
    controller.listMine,
  )
}

export default streams
