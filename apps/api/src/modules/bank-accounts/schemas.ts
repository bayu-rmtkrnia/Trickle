import type { FastifySchema } from 'fastify'
import { z } from 'zod'
import type { BankAccount } from '../../generated/prisma/client.js'
import { Page, PageQuery } from '../../lib/pagination.js'
import { errors, IdParams } from '../../lib/schemas.js'

const security = [{ bearerAuth: [] }]
const tags = ['Bank accounts']

/** Banks the payout sandbox can send to. Mapped to provider codes in Fitur 11. */
export const BANK_CODES = [
  'BCA',
  'BNI',
  'BRI',
  'MANDIRI',
  'BSI',
  'CIMB',
  'PERMATA',
  'DANAMON',
  'BTN',
  'OCBC',
] as const

const AccountNumber = z
  .string()
  .regex(/^[0-9 -]+$/, 'must contain digits only')
  .transform((s) => s.replace(/[ -]/g, ''))
  .refine((s) => s.length >= 6 && s.length <= 20, 'must be 6–20 digits')
  .describe('Digits; spaces and dashes are ignored. Stored encrypted, never returned')

const BankAccountFields = z.object({
  accountName: z.string().trim().min(2).max(100).describe('Name on the account'),
  label: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .nullable()
    .optional()
    .describe('Optional nickname, e.g. "Rekening utama"'),
})

export const CreateBankAccountInput = BankAccountFields.extend({
  bankCode: z.enum(BANK_CODES),
  accountNumber: AccountNumber,
})

export type CreateBankAccountInput = z.infer<typeof CreateBankAccountInput>
export type UpdateBankAccountInput = Partial<z.infer<typeof BankAccountFields>>

export const BankAccountDto = z
  .object({
    id: z.string(),
    bankCode: z.enum(BANK_CODES),
    accountName: z.string(),
    label: z.string().nullable(),
    accountNumberLast4: z.string().describe('The full number never leaves the server'),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'BankAccount' })

export const toBankAccountDto = (b: BankAccount) => ({
  id: b.id,
  bankCode: b.bankCode as (typeof BANK_CODES)[number],
  accountName: b.accountName,
  label: b.label,
  accountNumberLast4: b.numberLast4,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
})

export const createBankAccountSchema = {
  tags,
  summary: 'Add a bank account to cash out to (recipient)',
  description:
    'The number is encrypted before it is stored; responses only show the last 4 digits. ' +
    'Re-adding a removed account restores it. 409 `BANK_ACCOUNT_EXISTS` if already added, ' +
    '`BANK_ACCOUNT_LIMIT` past 5 accounts. 503 `BANK_ACCOUNTS_UNAVAILABLE` if encryption is not configured.',
  security,
  body: CreateBankAccountInput,
  response: { 201: BankAccountDto, ...errors(400, 401, 403, 409, 422, 503) },
} satisfies FastifySchema

export const listBankAccountsSchema = {
  tags,
  summary: 'My bank accounts (recipient)',
  security,
  querystring: PageQuery,
  response: { 200: Page(BankAccountDto), ...errors(401, 403, 422) },
} satisfies FastifySchema

export const getBankAccountSchema = {
  tags,
  summary: 'Get one of my bank accounts',
  security,
  params: IdParams,
  response: { 200: BankAccountDto, ...errors(401, 403, 404, 422) },
} satisfies FastifySchema

export const updateBankAccountSchema = {
  tags,
  summary: 'Rename one of my bank accounts',
  description:
    'Only the name and label can change. To use a different number, add a new account and remove this one.',
  security,
  params: IdParams,
  body: BankAccountFields.partial(),
  response: { 200: BankAccountDto, ...errors(400, 401, 403, 404, 422) },
} satisfies FastifySchema

export const deleteBankAccountSchema = {
  tags,
  summary: 'Remove one of my bank accounts (soft delete)',
  security,
  params: IdParams,
  response: { 204: z.null().describe('Removed'), ...errors(401, 403, 404, 422) },
} satisfies FastifySchema
