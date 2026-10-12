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
    'Called by the web app before the first transaction (e.g. a withdrawal), so users never hold or see MON. ' +
    'Open to any signed-in account, including brand-new judge mode accounts. ' +
    'Idempotent: calling again returns the original drip (200). `SENT` means broadcast; wait for the receipt of `txHash` before relying on the balance.\n\n' +
    'Errors: 429 `DRIP_IP_LIMIT` (per IP per day), `DRIP_DAILY_LIMIT` (all users), `RATE_LIMITED`; ' +
    '503 `DRIP_UNAVAILABLE` (no treasury configured), `DRIP_TREASURY_EMPTY`; 502 `DRIP_FAILED` (safe to retry).',
  security: [{ bearerAuth: [] }],
  response: { 200: DripDto, 201: DripDto, ...errors(401, 429, 502, 503) },
} satisfies FastifySchema

export const gasStatusSchema = {
  tags: ['Gas'],
  summary: 'Treasury balance and drip usage, for monitoring',
  response: { 200: GasStatus },
} satisfies FastifySchema

const deprecated = (successor: string) => ({
  deprecated: true,
  description: `Deprecated: use \`${successor}\`. Kept until the web app moves over; same behaviour.`,
})

export const legacyDripSchema = { ...dripSchema, ...deprecated('POST /gas-drips') }
export const legacyGasStatusSchema = {
  ...gasStatusSchema,
  ...deprecated('GET /gas-drips/status'),
}
