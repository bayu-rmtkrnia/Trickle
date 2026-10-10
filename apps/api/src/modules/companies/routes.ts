import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { idParam } from '../../lib/http.js'
import { createCompanyController } from './controller.js'
import { createCompanyRepository } from './repository.js'
import {
  createCompanySchema,
  deleteCompanySchema,
  getCompanySchema,
  listCompanyWorkersSchema,
  updateCompanySchema,
} from './schemas.js'
import { companyNotFound, createCompanyService } from './service.js'

const companies: FastifyPluginAsyncZod = async (app) => {
  const repo = createCompanyRepository(app.db)
  const controller = createCompanyController(createCompanyService(repo))

  // Creating a company is how you become an employer, so it only needs a session.
  app.post(
    '/companies',
    { onRequest: [app.authenticate], schema: createCompanySchema },
    controller.create,
  )

  // Everything under /companies/:id: role check, then ownership (PLAN §6.3, K5).
  const ownerOnly = {
    onRequest: [app.authenticate, app.requireRole('employer')],
    preHandler: [app.requireOwnership((req) => repo.findOwnerId(idParam(req)), companyNotFound)],
  }
  app.get('/companies/:id', { ...ownerOnly, schema: getCompanySchema }, controller.get)
  app.patch('/companies/:id', { ...ownerOnly, schema: updateCompanySchema }, controller.update)
  app.delete('/companies/:id', { ...ownerOnly, schema: deleteCompanySchema }, controller.remove)
  app.get(
    '/companies/:id/workers',
    { ...ownerOnly, schema: listCompanyWorkersSchema },
    controller.listWorkers,
  )
}

export default companies
