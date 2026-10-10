import type { Handler } from '../../lib/http.js'
import type {
  createCompanySchema,
  deleteCompanySchema,
  getCompanySchema,
  listCompanyWorkersSchema,
  updateCompanySchema,
} from './schemas.js'
import type { CompanyService } from './service.js'

export function createCompanyController(service: CompanyService) {
  const create: Handler<typeof createCompanySchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.user.sub, req.body))
  }

  const get: Handler<typeof getCompanySchema> = async (req) => service.get(req.params.id)

  const update: Handler<typeof updateCompanySchema> = async (req) =>
    service.update(req.params.id, req.body)

  const remove: Handler<typeof deleteCompanySchema> = async (req, reply) => {
    await service.remove(req.params.id)
    return reply.code(204).send(null)
  }

  const listWorkers: Handler<typeof listCompanyWorkersSchema> = async (req) =>
    service.listWorkers(req.params.id, req.query)

  return { create, get, update, remove, listWorkers }
}
