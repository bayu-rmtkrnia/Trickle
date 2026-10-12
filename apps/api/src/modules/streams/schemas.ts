import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { Stream } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Streams']

export const STREAM_STATUSES = ['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELED'] as const
export type StreamStatus = (typeof STREAM_STATUSES)[number]

/** Stream ids are on-chain integers, so the cursor is one too (not a cuid like other lists). */
export const StreamPageQuery = PageQuery.extend({
  cursor: z
    .string()
    .regex(/^[1-9]\d{0,30}$/, 'must be a stream id')
    .optional()
    .describe('`nextCursor` from the previous page. Omit for the first page.'),
})

export type StreamPageQuery = z.infer<typeof StreamPageQuery>

const units = z.string().describe('Token units (6 decimals), as a decimal string')

const StreamFields = z.object({
  id: z.string().describe('On-chain stream id, as a decimal string'),
  employerAddress: z.string(),
  workerAddress: z.string(),
  amountUnits: units,
  withdrawnUnits: units,
  refundedUnits: units,
  startsAt: z.string(),
  endsAt: z.string(),
  status: z
    .enum(STREAM_STATUSES)
    .describe('Derived when read: CANCELED, else SCHEDULED before start, ENDED after end'),
  syncedAt: z
    .string()
    .describe(
      'When the indexer last read this stream. Streamed amounts change every second: compute them from start/end, or read `withdrawable` on-chain',
    ),
})

export const CompanyStreamDto = StreamFields.extend({
  worker: z
    .object({ id: z.string(), displayName: z.string() })
    .nullable()
    .describe('The worker row in this company for `workerAddress`, or `null` if there is none'),
}).meta({ id: 'CompanyStream' })

export const MyStreamDto = StreamFields.extend({
  company: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .describe(
      'The active company owned by `employerAddress`, or `null` (e.g. the judge-mode demo employer)',
    ),
}).meta({ id: 'MyStream' })

export function statusOf(
  s: Pick<Stream, 'canceled' | 'startsAt' | 'endsAt'>,
  now: Date,
): StreamStatus {
  if (s.canceled) return 'CANCELED'
  if (now < s.startsAt) return 'SCHEDULED'
  if (now >= s.endsAt) return 'ENDED'
  return 'ACTIVE'
}

export const toStreamFields = (s: Stream, now: Date) => ({
  id: s.id.toString(),
  employerAddress: s.employer,
  workerAddress: s.worker,
  amountUnits: s.amountUnits,
  withdrawnUnits: s.withdrawnUnits,
  refundedUnits: s.refundedUnits,
  startsAt: s.startsAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
  status: statusOf(s, now),
  syncedAt: s.syncedAt.toISOString(),
})

const listDescription =
  'From the stream indexer (a cache of the contract), newest first. Streams created since the last indexer round are fetched before answering.'

export const listCompanyStreamsSchema = {
  tags,
  summary: "Streams my company's owner wallet funds (employer)",
  description: listDescription,
  security,
  params: IdParams,
  querystring: StreamPageQuery,
  response: { 200: Page(CompanyStreamDto), ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const listMyStreamsSchema = {
  tags,
  summary: 'Streams paying my wallet (worker)',
  description: `${listDescription} No role check: includes judge-mode demo streams, and is empty for accounts that are paid nothing.`,
  security,
  querystring: StreamPageQuery,
  response: { 200: Page(MyStreamDto), ...errors(401, 422) },
} satisfies FastifySchema
