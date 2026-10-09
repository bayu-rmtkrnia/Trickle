import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { errors } from '../../lib/schemas.js'
import { UserDto } from '../users/schemas.js'

export const createSessionSchema = {
  tags: ['Sessions'],
  summary: 'Sign in with a Privy access token',
  description:
    'Exchanges the access token from Privy (`getAccessToken()` in the web app) for a Trickle session token. ' +
    'Send it as `Authorization: Bearer <token>` on protected endpoints. The account is keyed to the Privy embedded wallet; ' +
    '409 `WALLET_NOT_READY` means Privy has not created that wallet yet, so retry shortly.',
  body: z.object({ accessToken: z.string().min(1) }),
  response: {
    201: z.object({
      token: z.string().describe('Opaque session token. Only its hash is stored server-side'),
      expiresAt: z.string(),
      user: UserDto,
    }),
    ...errors(400, 401, 409, 422, 429, 502, 503),
  },
} satisfies FastifySchema

export const deleteCurrentSessionSchema = {
  tags: ['Sessions'],
  summary: 'Sign out (revoke the session token used for this request)',
  security: [{ bearerAuth: [] }],
  response: { 204: z.null().describe('Signed out'), ...errors(401) },
} satisfies FastifySchema
