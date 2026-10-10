import type { Handler } from '../../lib/http.js'
import type { getMeSchema, updateMeSchema } from './schemas.js'
import type { UserService } from './service.js'

export function createUserController(service: UserService) {
  const getMe: Handler<typeof getMeSchema> = async (req) => service.me(req.user.sub)

  const updateMe: Handler<typeof updateMeSchema> = async (req) =>
    service.updateMe(req.user.sub, req.body)

  return { getMe, updateMe }
}
