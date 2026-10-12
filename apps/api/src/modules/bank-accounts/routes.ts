import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createFieldCipher } from '../../lib/crypto.js'
import { idParam } from '../../lib/http.js'
import { createBankAccountController } from './controller.js'
import { createBankAccountRepository } from './repository.js'
import {
  createBankAccountSchema,
  deleteBankAccountSchema,
  getBankAccountSchema,
  listBankAccountsSchema,
  updateBankAccountSchema,
} from './schemas.js'
import { bankAccountNotFound, createBankAccountService } from './service.js'

const bankAccounts: FastifyPluginAsyncZod = async (app) => {
  const repo = createBankAccountRepository(app.db)
  const key = app.env.BANK_ENCRYPTION_KEY
  const controller = createBankAccountController(
    createBankAccountService({ repo, cipher: key ? createFieldCipher(key) : undefined }),
  )
  // Recipients cash out to a bank (PLAN §6.3 "R pemilik"); workers withdraw on-chain.
  const recipient = [app.authenticate, app.requireRole('recipient')]

  // The collection is always the signed-in user's own, so no ownership check.
  app.post(
    '/bank-accounts',
    { onRequest: recipient, schema: createBankAccountSchema },
    controller.create,
  )
  app.get(
    '/bank-accounts',
    { onRequest: recipient, schema: listBankAccountsSchema },
    controller.list,
  )

  const owner = {
    onRequest: recipient,
    preHandler: [
      app.requireOwnership((req) => repo.findOwnerId(idParam(req)), bankAccountNotFound),
    ],
  }
  app.get('/bank-accounts/:id', { ...owner, schema: getBankAccountSchema }, controller.get)
  app.patch('/bank-accounts/:id', { ...owner, schema: updateBankAccountSchema }, controller.update)
  app.delete('/bank-accounts/:id', { ...owner, schema: deleteBankAccountSchema }, controller.remove)
}

export default bankAccounts
