import { unauthorized } from '../../lib/errors.js'
import type { UserRepository } from './repository.js'
import { toUserDto, type UpdateMeInput } from './schemas.js'

const gone = () => unauthorized('Account no longer exists. Sign in again.')

export function createUserService(repo: UserRepository) {
  async function me(userId: string) {
    const user = await repo.findWithRoleCounts(userId)
    if (!user) throw gone()
    return {
      ...toUserDto(user),
      roles: {
        employer: Boolean(user.employer),
        worker: user._count.employments > 0,
        family: user._count.familyAsRelative > 0,
      },
    }
  }

  return {
    me,

    async updateMe(userId: string, input: UpdateMeInput) {
      if (!(await repo.update(userId, { displayName: input.displayName }))) throw gone()
      return me(userId)
    },
  }
}

export type UserService = ReturnType<typeof createUserService>
