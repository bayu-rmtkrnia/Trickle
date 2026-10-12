import type { FastifySchema } from 'fastify'
import { formatUnits } from 'viem'
import { z } from 'zod'
import type { Payout } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Payouts']

export const PayoutStatus = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])

export const CreatePayoutInput = z.object({
  txHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte transaction hash')
    .transform((h) => h.toLowerCase() as `0x${string}`)
    .describe('The token transfer from your account to `PAYOUT_ADDRESS`'),
  bankAccountId: z.string().min(1).max(64).describe('One of your `/bank-accounts`'),
})

export type CreatePayoutInput = z.infer<typeof CreatePayoutInput>

export const PayoutDto = z
  .object({
    id: z.string(),
    status: PayoutStatus,
    amountUsd: z.string().describe('What the transfer moved, in mock AUSD'),
    amountIdr: z.number().int().nullable().describe('What the bank receives'),
    fxRate: z.number().nullable().describe('IDR per USD used for `amountIdr`'),
    fxSource: z.string().nullable().describe('`live`, `cache` or `fallback` (see `/fx-rates`)'),
    sourceTxHash: z.string(),
    bankAccount: z.object({
      id: z.string(),
      bankCode: z.string(),
      accountNumberLast4: z.string(),
    }),
    provider: z.string(),
    providerRef: z
      .string()
      .nullable()
      .describe("The provider's reference; webhooks identify the payout by it"),
    testMode: z
      .literal(true)
      .describe('The bank transfer is a sandbox; label it "Mode uji" (PLAN §3.2)'),
    failureReason: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'Payout' })

export type PayoutWithAccount = Payout & {
  bankAccount: { id: string; bankCode: string; numberLast4: string }
}

export const toPayoutDto = (p: PayoutWithAccount): z.infer<typeof PayoutDto> => ({
  id: p.id,
  status: p.status,
  amountUsd: formatUnits(BigInt(p.amountUnits), 6),
  amountIdr: p.amountIdr,
  fxRate: p.fxRate,
  fxSource: p.fxSource,
  sourceTxHash: p.sourceTxHash,
  bankAccount: {
    id: p.bankAccount.id,
    bankCode: p.bankAccount.bankCode,
    accountNumberLast4: p.bankAccount.numberLast4,
  },
  provider: p.provider,
  providerRef: p.providerRef,
  testMode: true,
  failureReason: p.failureReason,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
})

export const createPayoutSchema = {
  tags,
  summary: 'Cash out a transfer to one of my bank accounts (recipient)',
  description:
    'First transfer mock AUSD from your account to `PAYOUT_ADDRESS` on-chain, then send its hash here. ' +
    'The API checks the receipt (token, sender, recipient, amount), converts at the current USD→IDR rate, ' +
    'and starts a sandbox disbursement. Poll `GET /payouts/:id` until `COMPLETED` or `FAILED`.\n\n' +
    'One payout per transfer: sending the same hash again returns the first payout (200). ' +
    'Errors: 409 `TX_PENDING` (not mined yet, retry), `PAYOUT_EXISTS` (another account used this hash); ' +
    '400 `TX_FAILED`, `TX_NOT_A_PAYOUT`; 404 `BANK_ACCOUNT_NOT_FOUND`; 503 `PAYOUTS_UNAVAILABLE`.',
  security,
  body: CreatePayoutInput,
  response: {
    200: PayoutDto,
    201: PayoutDto,
    ...errors(400, 401, 403, 404, 409, 422, 502, 503),
  },
} satisfies FastifySchema

export const listPayoutsSchema = {
  tags,
  summary: 'My payouts (recipient)',
  security,
  querystring: PageQuery,
  response: { 200: Page(PayoutDto), ...errors(401, 403, 422) },
} satisfies FastifySchema

export const getPayoutSchema = {
  tags,
  summary: 'One of my payouts, with its latest status',
  security,
  params: IdParams,
  response: { 200: PayoutDto, ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const WebhookInput = z.object({
  providerRef: z.string().min(1).max(128),
  status: z.enum(['COMPLETED', 'FAILED']),
  failureReason: z.string().max(200).optional(),
})

export const payoutWebhookSchema = {
  tags,
  summary: 'Disbursement status from the payout provider',
  description:
    'Called by the provider, not the web app. Signed with `PAYOUT_WEBHOOK_SECRET`: ' +
    '`x-payout-timestamp` is Unix seconds (at most 5 minutes old) and ' +
    '`x-payout-signature` is `sha256=` + hex HMAC-SHA256 of `<timestamp>.<raw body>`. ' +
    'Idempotent: a payout that already finished keeps its status.',
  body: WebhookInput,
  response: {
    200: z.object({ received: z.literal(true) }),
    ...errors(400, 401, 404, 422, 503),
  },
} satisfies FastifySchema
