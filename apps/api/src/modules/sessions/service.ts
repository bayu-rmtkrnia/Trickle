import type { Env } from '../../env.js'
import { conflict } from '../../lib/errors.js'
import type { Privy } from '../../lib/privy.js'
import { hashToken, newSessionToken } from '../../lib/tokens.js'
import { toUserDto } from '../users/schemas.js'
import type { SessionRepository } from './repository.js'

interface Deps {
  repo: SessionRepository
  privy: Privy
  env: Pick<Env, 'SESSION_TTL_DAYS'>
}

export function createSessionService({ repo, privy, env }: Deps) {
  return {
    async create(accessToken: string) {
      const { privyId } = await privy.verifyAccessToken(accessToken)

      // Only the first sign-in needs the wallet address, which costs a call to Privy.
      const known = await repo.findUserByPrivyId(privyId)
      let user
      if (known) {
        user = await repo.recordLogin(known.id)
      } else {
        const address = await privy.getWalletAddress(privyId)
        if (!address) {
          throw conflict(
            'WALLET_NOT_READY',
            'Your wallet is still being created. Try again in a moment.',
          )
        }
        user = await repo.linkPrivyUser(privyId, address)
      }

      const token = newSessionToken()
      const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
      await repo.create({ userId: user.id, tokenHash: hashToken(token), expiresAt })

      return { token, expiresAt: expiresAt.toISOString(), user: toUserDto(user) }
    },

    async revoke(sessionId: string) {
      await repo.revoke(sessionId)
    },
  }
}

export type SessionService = ReturnType<typeof createSessionService>
