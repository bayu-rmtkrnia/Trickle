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

/**
 * E-wallets the payout sandbox can send to (KF-17). Their "account number" is
 * the phone number registered with the wallet. Same simulated provider as banks.
 */
export const EWALLET_CODES = ['GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA'] as const

/** Every destination a payout can go to: banks and e-wallets share one table. */
export const PAYOUT_CODES = [...BANK_CODES, ...EWALLET_CODES] as const
export type PayoutCode = (typeof PAYOUT_CODES)[number]

export const isEwallet = (code: string) => (EWALLET_CODES as readonly string[]).includes(code)
export const accountType = (code: string): 'BANK' | 'EWALLET' =>
  isEwallet(code) ? 'EWALLET' : 'BANK'

const AccountNumber = z
  .string()
  .regex(/^\+?[0-9 -]+$/, 'must contain digits only')
  .transform((s) => s.replace(/[ +-]/g, ''))
  .refine((s) => s.length >= 6 && s.length <= 20, 'must be 6–20 digits')
  .describe(
    'Bank account number, or the phone number for an e-wallet (`08…` or `628…`). Spaces, dashes and a leading + are ignored. Stored encrypted, never returned',
  )

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

/** Indonesian mobile number, normalized to `08…` so `0812…` and `62812…` are the same wallet. */
const PHONE = /^08\d{8,11}$/
const toLocalPhone = (digits: string) => (digits.startsWith('62') ? `0${digits.slice(2)}` : digits)

export const CreateBankAccountInput = BankAccountFields.extend({
  bankCode: z
    .enum(PAYOUT_CODES)
    .describe('A bank, or an e-wallet (GOPAY, OVO, DANA, SHOPEEPAY, LINKAJA)'),
  accountNumber: AccountNumber,
})
  .superRefine((input, ctx) => {
    if (isEwallet(input.bankCode) && !PHONE.test(toLocalPhone(input.accountNumber)))
      ctx.addIssue({
        code: 'custom',
        path: ['accountNumber'],
        message: 'must be the phone number of the e-wallet, e.g. 0812xxxxxxxx',
      })
  })
  .transform((input) =>
    isEwallet(input.bankCode)
      ? { ...input, accountNumber: toLocalPhone(input.accountNumber) }
      : input,
  )

export type CreateBankAccountInput = z.infer<typeof CreateBankAccountInput>
export type UpdateBankAccountInput = Partial<z.infer<typeof BankAccountFields>>

export const BankAccountDto = z
  .object({
    id: z.string(),
    bankCode: z.enum(PAYOUT_CODES),
    type: z.enum(['BANK', 'EWALLET']).describe('`EWALLET` when `bankCode` is an e-wallet'),
    accountName: z.string(),
    label: z.string().nullable(),
    accountNumberLast4: z.string().describe('The full number never leaves the server'),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .meta({ id: 'BankAccount' })

export const toBankAccountDto = (b: BankAccount) => ({
  id: b.id,
  bankCode: b.bankCode as PayoutCode,
  type: accountType(b.bankCode),
  accountName: b.accountName,
  label: b.label,
  accountNumberLast4: b.numberLast4,
  createdAt: b.createdAt.toISOString(),
  updatedAt: b.updatedAt.toISOString(),
})

export const createBankAccountSchema = {
  tags,
  summary: 'Add a bank account or e-wallet to cash out to (recipient)',
  description:
    'For an e-wallet (GOPAY, OVO, DANA, SHOPEEPAY, LINKAJA), `accountNumber` is its phone number, stored as `08…`; payouts to it go through the same sandbox provider as banks. ' +
    'The number is encrypted before it is stored; responses only show the last 4 digits. ' +
    'Re-adding a removed account restores it. 409 `BANK_ACCOUNT_EXISTS` if already added, ' +
    '`BANK_ACCOUNT_LIMIT` past 5 accounts. 503 `BANK_ACCOUNTS_UNAVAILABLE` if encryption is not configured.',
  security,
  body: CreateBankAccountInput,
  response: { 201: BankAccountDto, ...errors(400, 401, 403, 409, 422, 503) },
} satisfies FastifySchema

export const listBankAccountsSchema = {
  tags,
  summary: 'My bank accounts and e-wallets (recipient)',
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
