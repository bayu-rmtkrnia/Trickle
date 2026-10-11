import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { idParam } from '../../lib/http.js'
import { companyNotFound } from '../companies/service.js'
import { createWorkerController } from './controller.js'
import { createWorkerRepository } from './repository.js'
import {
  createWorkerSchema,
  deleteWorkerSchema,
  getWorkerSchema,
  listWorkersSchema,
  updateWorkerSchema,
} from './schemas.js'
import { createWorkerService, workerNotFound } from './service.js'

const workers: FastifyPluginAsyncZod = async (app) => {
  const repo = createWorkerRepository(app.db)
  const controller = createWorkerController(createWorkerService({ repo, streams: app.streams }))
  const employer = [app.authenticate, app.requireRole('employer')]

  // /companies/:id/workers: owner of the company only.
  const companyOwner = {
    onRequest: employer,
    preHandler: [
      app.requireOwnership((req) => repo.findCompanyOwnerId(idParam(req)), companyNotFound),
    ],
  }
  app.post(
    '/companies/:id/workers',
    { ...companyOwner, schema: createWorkerSchema },
    controller.create,
  )
  app.get('/companies/:id/workers', { ...companyOwner, schema: listWorkersSchema }, controller.list)

  // /workers/:id: the employer may read and change; the worker may only read themself.
  const workerOwner = (includeSelf: boolean) => async (id: string) => {
    const access = await repo.findAccess(id)
    if (!access) return null
    return includeSelf ? [access.ownerId, access.userId] : access.ownerId
  }
  app.get(
    '/workers/:id',
    {
      onRequest: [app.authenticate, app.requireRole('employer', 'worker')],
      preHandler: [app.requireOwnership((req) => workerOwner(true)(idParam(req)), workerNotFound)],
      schema: getWorkerSchema,
    },
    controller.get,
  )
  const employerOnly = {
    onRequest: employer,
    preHandler: [app.requireOwnership((req) => workerOwner(false)(idParam(req)), workerNotFound)],
  }
  app.patch('/workers/:id', { ...employerOnly, schema: updateWorkerSchema }, controller.update)
  app.delete('/workers/:id', { ...employerOnly, schema: deleteWorkerSchema }, controller.remove)
}

export default workers
