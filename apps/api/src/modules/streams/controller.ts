import type { Handler } from '../../lib/http.js'
import type { listCompanyStreamsSchema, listMyStreamsSchema } from './schemas.js'
import type { StreamService } from './service.js'

export function createStreamController(service: StreamService) {
  const listForCompany: Handler<typeof listCompanyStreamsSchema> = async (req) =>
    service.listForCompany(req.params.id, req.query, req.log)

  const listMine: Handler<typeof listMyStreamsSchema> = async (req) =>
    service.listMine(req.user.sub, req.query, req.log)

  return { listForCompany, listMine }
}
