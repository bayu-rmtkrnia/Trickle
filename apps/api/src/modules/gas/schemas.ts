import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { errors } from '../../lib/schemas.js'

export const DripDto = z
  .object({
    address: z.string(),
    status: z.enum(['PENDING', 'SENT', 'FAILED']),
    amountMon: z.string(),
    txHash: z.string().nullable(),
    alreadyDripped: z
      .boolean()
      .describe('true when an earlier drip still covers this address; nothing was sent'),
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
  summary: "Fund the signed-in account's gas, and refill it when it runs low",
  description:
    'Called by the web app before the first transaction (e.g. a withdrawal), so users never hold or see MON. ' +
    'Open to any signed-in account, including brand-new judge mode accounts. ' +
    'Calling again returns the latest drip (200, `alreadyDripped: true`) while the account still has at least `GAS_DRIP_REFILL_BELOW_MON`. ' +
    'Once it runs below that (e.g. an employer funding several streams), the next call sends a refill (201), at most `GAS_DRIP_ADDRESS_DAILY_LIMIT` drips per address per day. ' +
    'A refill waits 30 seconds after the previous drip so its MON can land first. ' +
    '`SENT` means broadcast; wait for the receipt of `txHash` before relying on the balance.\n\n' +
    'Errors: 429 `DRIP_IP_LIMIT` (new accounts per IP per day; refills do not count), `DRIP_ADDRESS_LIMIT` (drips per address per day), `DRIP_DAILY_LIMIT` (all users), `RATE_LIMITED`; ' +
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
