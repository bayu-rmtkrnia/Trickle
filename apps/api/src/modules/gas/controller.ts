import type { Handler } from '../../lib/http.js'
import type { dripSchema, gasStatusSchema } from './schemas.js'
import type { GasService } from './service.js'

export function createGasController(service: GasService) {
  const drip: Handler<typeof dripSchema> = async (req, reply) => {
    const result = await service.drip(req.user.address, req.ip, req.log)
    return reply.code(result.created ? 201 : 200).send(result.drip)
  }

  const status: Handler<typeof gasStatusSchema> = async (req) => service.status(req.log)

  return { drip, status }
}
