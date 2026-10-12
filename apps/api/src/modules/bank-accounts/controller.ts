import type { Handler } from '../../lib/http.js'
import type {
  createBankAccountSchema,
  deleteBankAccountSchema,
  getBankAccountSchema,
  listBankAccountsSchema,
  updateBankAccountSchema,
} from './schemas.js'
import type { BankAccountService } from './service.js'

export function createBankAccountController(service: BankAccountService) {
  const create: Handler<typeof createBankAccountSchema> = async (req, reply) => {
    return reply.code(201).send(await service.create(req.user.sub, req.body))
  }

  const list: Handler<typeof listBankAccountsSchema> = async (req) =>
    service.list(req.user.sub, req.query)

  const get: Handler<typeof getBankAccountSchema> = async (req) => service.get(req.params.id)

  const update: Handler<typeof updateBankAccountSchema> = async (req) =>
    service.update(req.params.id, req.body)

  const remove: Handler<typeof deleteBankAccountSchema> = async (req, reply) => {
    await service.remove(req.params.id)
    return reply.code(204).send(null)
  }

  return { create, list, get, update, remove }
}
