import { getAddress, verifyMessage } from 'viem'
import { createSiweMessage, generateSiweNonce, parseSiweMessage } from 'viem/siwe'
import type { Env } from '../../env.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import type { Session } from '../../types.js'
import type { AuthRepository } from './repository.js'
import { toUserDto } from './schemas.js'

interface Deps {
  repo: AuthRepository
  env: Pick<Env, 'AUTH_CHALLENGE_TTL_SECONDS' | 'AUTH_DOMAIN' | 'CHAIN_ID' | 'WEB_URL'>
  /** Issues the session token. Injected so the service does not depend on Fastify. */
  signToken: (session: Session) => Promise<string>
}

export function createAuthService({ repo, env, signToken }: Deps) {
  return {
    async createChallenge(address: `0x${string}`) {
      const nonce = generateSiweNonce()
      const issuedAt = new Date()
      const expiresAt = new Date(issuedAt.getTime() + env.AUTH_CHALLENGE_TTL_SECONDS * 1000)

      await repo.createChallenge({ nonce, address, expiresAt })

      const message = createSiweMessage({
        // SIWE requires an EIP-55 checksummed address.
        address: getAddress(address),
        chainId: env.CHAIN_ID,
        domain: env.AUTH_DOMAIN,
        uri: env.WEB_URL,
        nonce,
        version: '1',
        statement: 'Sign in to Trickle',
        issuedAt,
        expirationTime: expiresAt,
      })

      return { nonce, message, expiresAt: expiresAt.toISOString() }
    },

    async verify(message: string, signature: `0x${string}`) {
      const fields = parseSiweMessage(message)
      if (!fields.address || !fields.nonce) {
        throw badRequest('INVALID_MESSAGE', 'Sign-in message is malformed')
      }
      if (fields.domain !== env.AUTH_DOMAIN || fields.chainId !== env.CHAIN_ID) {
        throw unauthorized('Sign-in message was issued for a different site')
      }
      const address = fields.address.toLowerCase() as `0x${string}`

      const challenge = await repo.findChallenge(fields.nonce)
      if (!challenge || challenge.address !== address) {
        throw unauthorized('Unknown sign-in request. Request a new one.')
      }
      if (challenge.usedAt) throw unauthorized('This sign-in request was already used')
      if (challenge.expiresAt < new Date()) throw unauthorized('Sign-in request expired')

      const valid = await verifyMessage({ address: fields.address, message, signature }).catch(
        () => false,
      )
      if (!valid) throw unauthorized('Signature does not match the address')

      // Burn the nonce atomically so a replayed request can't win a race.
      if (!(await repo.burnChallenge(fields.nonce))) {
        throw unauthorized('This sign-in request was already used')
      }

      const user = await repo.upsertUserOnLogin(address)
      const token = await signToken({ sub: user.id, address })
      return { token, user: toUserDto(user) }
    },

    async me(userId: string) {
      const user = await repo.findUserWithRoleCounts(userId)
      if (!user) throw unauthorized('Account no longer exists. Sign in again.')
      return {
        ...toUserDto(user),
        roles: {
          employer: Boolean(user.employer),
          worker: user._count.employments > 0,
          family: user._count.familyAsRelative > 0,
        },
      }
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
