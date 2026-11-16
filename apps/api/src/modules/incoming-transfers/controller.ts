import type { Handler } from '../../lib/http.js'
import type { listIncomingTransfersSchema } from './schemas.js'
import type { IncomingTransferService } from './service.js'

export function createIncomingTransferController(service: IncomingTransferService) {
  const listMine: Handler<typeof listIncomingTransfersSchema> = async (req) =>
    service.listMine(req.user.sub, req.query, req.log)

  return { listMine }
}
