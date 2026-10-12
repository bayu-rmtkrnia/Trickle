import type { Handler } from '../../lib/http.js'
import type { getMeSchema, listMyEmploymentsSchema, updateMeSchema } from './schemas.js'
import type { UserService } from './service.js'

export function createUserController(service: UserService) {
  const getMe: Handler<typeof getMeSchema> = async (req) => service.me(req.user.sub)

  const updateMe: Handler<typeof updateMeSchema> = async (req) =>
    service.updateMe(req.user.sub, req.body)

  const listEmployments: Handler<typeof listMyEmploymentsSchema> = async (req) =>
    service.listEmployments(req.user.sub, req.query)

  return { getMe, updateMe, listEmployments }
}
