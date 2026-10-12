import { unauthorized } from '../../lib/errors.js'
import { toPage, type PageQuery } from '../../lib/pagination.js'
import { toRoles } from '../../lib/roles.js'
import type { UserRepository } from './repository.js'
import { toEmploymentDto, toUserDto, type UpdateMeInput } from './schemas.js'

const gone = () => unauthorized('Account no longer exists. Sign in again.')

export function createUserService(repo: UserRepository) {
  async function me(userId: string) {
    const user = await repo.findWithRoleCounts(userId)
    if (!user) throw gone()
    return { ...toUserDto(user), companyId: user.companies[0]?.id ?? null, roles: toRoles(user) }
  }

  return {
    me,

    async updateMe(userId: string, input: UpdateMeInput) {
      if (!(await repo.update(userId, { displayName: input.displayName }))) throw gone()
      return me(userId)
    },

    async listEmployments(userId: string, page: PageQuery) {
      const rows = await repo.listEmployments(userId, page)
      return toPage(rows, page.limit, toEmploymentDto)
    },
  }
}

export type UserService = ReturnType<typeof createUserService>
