import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { User } from '../../generated/prisma/client.js'
import { Address, errors } from '../../lib/schemas.js'

export const UserDto = z
  .object({
    id: z.string(),
    address: z.string(),
    displayName: z.string().nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'User' })

export const toUserDto = (u: User) => ({
  id: u.id,
  address: u.address,
  displayName: u.displayName,
  createdAt: u.createdAt.toISOString(),
})

export const challengeSchema = {
  tags: ['Auth'],
  summary: 'Get a sign-in message for an address',
  description:
    'Returns an EIP-4361 (Sign-In with Ethereum) message. The client signs `message` with the Mera account and sends it to `/api/v1/auth/verify`. Nonces are single-use and expire after a few minutes.',
  body: z.object({ address: Address }),
  response: {
    201: z.object({ nonce: z.string(), message: z.string(), expiresAt: z.string() }),
    ...errors(400, 422, 429),
  },
} satisfies FastifySchema

export const verifySchema = {
  tags: ['Auth'],
  summary: 'Exchange a signed challenge for a session token',
  body: z.object({
    message: z.string().min(1),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'must be a 0x-prefixed hex signature'),
  }),
  response: {
    200: z.object({ token: z.string(), user: UserDto }),
    ...errors(400, 401, 422, 429),
  },
} satisfies FastifySchema

export const meSchema = {
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
} satisfies FastifySchema
