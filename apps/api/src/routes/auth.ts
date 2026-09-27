import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { getAddress, verifyMessage } from 'viem'
import { createSiweMessage, generateSiweNonce, parseSiweMessage } from 'viem/siwe'
import { z } from 'zod'
import { badRequest, unauthorized } from '../lib/errors.js'
import { Address, errors } from '../lib/schemas.js'
import { UserDto, toUserDto } from './dto.js'

const auth: FastifyPluginAsyncZod = async (app) => {
  const { env, db } = app

  app.post(
    '/auth/challenge',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Get a sign-in message for an address',
        description:
          'Returns an EIP-4361 (Sign-In with Ethereum) message. The client signs `message` with the Mera account and sends it to `/auth/verify`. Nonces are single-use and expire after a few minutes.',
        body: z.object({ address: Address }),
        response: {
          201: z.object({ nonce: z.string(), message: z.string(), expiresAt: z.string() }),
          ...errors(400, 429),
        },
      },
    },
    async (req, reply) => {
      const { address } = req.body
      const nonce = generateSiweNonce()
      const issuedAt = new Date()
      const expiresAt = new Date(issuedAt.getTime() + env.AUTH_CHALLENGE_TTL_SECONDS * 1000)

      await db.authChallenge.create({ data: { nonce, address, expiresAt } })

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

      return reply.code(201).send({ nonce, message, expiresAt: expiresAt.toISOString() })
    },
  )

  app.post(
    '/auth/verify',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        summary: 'Exchange a signed challenge for a session token',
        body: z.object({
          message: z.string().min(1),
          signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'must be a 0x-prefixed hex signature'),
        }),
        response: {
          200: z.object({ token: z.string(), user: UserDto }),
          ...errors(400, 401, 429),
        },
      },
    },
    async (req) => {
      const { message, signature } = req.body
      const fields = parseSiweMessage(message)
      if (!fields.address || !fields.nonce) {
        throw badRequest('INVALID_MESSAGE', 'Sign-in message is malformed')
      }
      if (fields.domain !== env.AUTH_DOMAIN || fields.chainId !== env.CHAIN_ID) {
        throw unauthorized('Sign-in message was issued for a different site')
      }
      const address = fields.address.toLowerCase() as `0x${string}`

      const challenge = await db.authChallenge.findUnique({ where: { nonce: fields.nonce } })
      if (!challenge || challenge.address !== address) {
        throw unauthorized('Unknown sign-in request. Request a new one.')
      }
      if (challenge.usedAt) throw unauthorized('This sign-in request was already used')
      if (challenge.expiresAt < new Date()) throw unauthorized('Sign-in request expired')

      const valid = await verifyMessage({
        address: fields.address,
        message,
        signature: signature as `0x${string}`,
      }).catch(() => false)
      if (!valid) throw unauthorized('Signature does not match the address')

      // Burn the nonce atomically so a replayed request can't win a race.
      const burned = await db.authChallenge.updateMany({
        where: { nonce: fields.nonce, usedAt: null },
        data: { usedAt: new Date() },
      })
      if (burned.count !== 1) throw unauthorized('This sign-in request was already used')

      const user = await db.user.upsert({
        where: { address },
        create: { address, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date() },
      })
      const token = await app.jwt.sign({ sub: user.id, address })
      return { token, user: toUserDto(user) }
    },
  )

  app.get(
    '/auth/me',
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Current user and the roles they hold',
        security: [{ bearerAuth: [] }],
        response: {
          200: UserDto.extend({
            roles: z.object({
              employer: z.boolean(),
              worker: z.boolean(),
              family: z.boolean(),
            }),
          }),
          ...errors(401),
        },
      },
    },
    async (req) => {
      const user = await db.user.findUnique({
        where: { id: req.user.sub },
        include: {
          employer: { select: { id: true } },
          _count: { select: { employments: true, familyAsRelative: true } },
        },
      })
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
  )
}

export default auth
