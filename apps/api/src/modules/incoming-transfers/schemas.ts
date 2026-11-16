import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors } from '../../lib/schemas.js'

export const IncomingTransferDto = z
  .object({
    id: z.string(),
    txHash: z.string().describe('The withdrawal transaction that paid this share'),
    streamId: z.string().describe('On-chain stream the worker withdrew from'),
    workerAddress: z.string().describe('Lowercased address of the worker who sent it'),
    amountUnits: z.string().describe('Token units (6 decimals), as a decimal string'),
    paidAt: z.string().describe('Block time of the withdrawal'),
    sender: z
      .object({ id: z.string(), displayName: z.string().nullable() })
      .nullable()
      .describe(
        'The Trickle account of `workerAddress`, or `null` if it has none. `displayName` falls back to the worker name an employer gave them',
      ),
  })
  .meta({ id: 'IncomingTransfer' })

export const listIncomingTransfersSchema = {
  tags: ['Recipients'],
  summary: 'Transfers my family members sent me through their salary split (recipient)',
  description:
    "Every `SplitPaid` event paying the caller's wallet, newest first. The split indexer scans contract logs in the background, and the newest blocks are read again before answering. History starts from when the indexer first ran (`SPLIT_BACKFILL_BLOCKS` before that). No role check: the list is empty for accounts nobody pays.",
  security: [{ bearerAuth: [] }],
  querystring: PageQuery,
  response: { 200: Page(IncomingTransferDto), ...errors(401, 422) },
} satisfies FastifySchema
