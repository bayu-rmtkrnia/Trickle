import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { errors } from '../../lib/schemas.js'

export const DripDto = z
  .object({
    address: z.string(),
    status: z.enum(['PENDING', 'SENT', 'FAILED']),
    amountMon: z.string(),
    txHash: z.string().nullable(),
    alreadyDripped: z.boolean().describe('true when this address was funded by an earlier call'),
    createdAt: z.string(),
  })
  .meta({ id: 'GasDrip' })

export type DripDto = z.infer<typeof DripDto>

export const GasStatus = z.object({
  configured: z.boolean(),
  treasuryAddress: z.string().nullable(),
  treasuryBalanceMon: z.string().nullable(),
  dripAmountMon: z.string(),
  dripsLast24h: z.number(),
  dailyLimit: z.number(),
  dripsRemainingOnBalance: z.number().nullable(),
})

export const dripSchema = {
  tags: ['Gas'],
  summary: "Fund the signed-in account's gas, once per address",
  description:
    'Called by the web app right after an account is created, so users never hold or see MON. Idempotent: calling again returns the original drip. Capped per day across all users.',
  security: [{ bearerAuth: [] }],
  response: { 200: DripDto, 201: DripDto, ...errors(401, 429, 502, 503) },
} satisfies FastifySchema

export const gasStatusSchema = {
  tags: ['Gas'],
  summary: 'Treasury balance and drip usage, for monitoring',
  response: { 200: GasStatus },
} satisfies FastifySchema
