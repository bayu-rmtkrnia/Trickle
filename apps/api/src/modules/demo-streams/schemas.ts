import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { errors } from '../../lib/schemas.js'

export const DemoStreamDto = z
  .object({
    id: z.string(),
    workerAddress: z.string().describe('The signed-in account; the stream pays this address'),
    amountUsd: z.string().describe('Total streamed over the whole duration, in mock AUSD'),
    durationSeconds: z.number(),
    status: z.enum(['PENDING', 'SENT', 'FAILED']),
    streamId: z
      .string()
      .nullable()
      .describe('On-chain stream id (decimal). Read the balance and withdraw on the contract'),
    txHash: z.string().nullable(),
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
    alreadyStarted: z.boolean().describe('true when an earlier call already created it'),
    createdAt: z.string(),
  })
  .meta({ id: 'DemoStream' })

export type DemoStreamDto = z.infer<typeof DemoStreamDto>

export const DemoStatus = z.object({
  configured: z.boolean(),
  employerAddress: z.string().nullable(),
  employerGasMon: z.string().nullable().describe('MON left for gas; null if it could not be read'),
  amountUsd: z.string(),
  durationSeconds: z.number(),
  streamsLast24h: z.number(),
  dailyLimit: z.number(),
})

export const createDemoStreamSchema = {
  tags: ['Demo'],
  summary: 'Judge mode: start a real testnet salary stream to the signed-in account',
  description:
    'The demo employer streams a small amount of mock AUSD to the caller on Monad testnet, so a visitor sees the worker balance grow without a faucet or a wallet. ' +
    'Open to any signed-in account, no role needed. One stream per account: calling again returns the first one (200). ' +
    'Limited per IP and per day (429 `DEMO_IP_LIMIT`, `DEMO_DAILY_LIMIT`).',
  security: [{ bearerAuth: [] }],
  response: { 200: DemoStreamDto, 201: DemoStreamDto, ...errors(401, 429, 502, 503) },
} satisfies FastifySchema

export const demoStatusSchema = {
  tags: ['Demo'],
  summary: 'Demo employer gas and usage, for monitoring during judging',
  response: { 200: DemoStatus },
} satisfies FastifySchema
