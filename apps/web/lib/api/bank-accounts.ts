import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

/** Mirrors `BANK_CODES` in apps/api/src/modules/bank-accounts/schemas.ts. */
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
/** Mirrors `EWALLET_CODES` in the API. The number is the wallet's phone number. */
export const EWALLET_CODES = ['GOPAY', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA'] as const
/** Every payout destination: banks and e-wallets share the `/bank-accounts` endpoints. */
export type BankCode = (typeof BANK_CODES)[number] | (typeof EWALLET_CODES)[number]
export type AccountType = 'BANK' | 'EWALLET'
const CODES: readonly string[] = [...BANK_CODES, ...EWALLET_CODES]

export const isEwalletCode = (code: string) => (EWALLET_CODES as readonly string[]).includes(code)
export const accountTypeOf = (code: string): AccountType =>
  isEwalletCode(code) ? 'EWALLET' : 'BANK'

/** Backend limit (`MAX_BANK_ACCOUNTS`); the server still enforces it. */
export const MAX_BANK_ACCOUNTS = 5

export interface BankAccountDto {
  id: string
  bankCode: BankCode
  /** Derived from `bankCode` when an older API leaves it out. */
  type: AccountType
  accountName: string
  label: string | null
  /** The full number never leaves the server. */
  accountNumberLast4: string
  createdAt: string
  updatedAt: string
}
export interface BankAccountPage {
  data: BankAccountDto[]
  nextCursor: string | null
}
export interface CreateBankAccountInput {
  bankCode: BankCode
  /** Digits only, as a string so leading zeros survive. */
  accountNumber: string
  accountName: string
  label?: string | null
}
export interface UpdateBankAccountInput {
  accountName?: string
  label?: string | null
}

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const time = (value: unknown) => text(value) && Number.isFinite(Date.parse(value))

function isBankAccount(value: unknown): value is BankAccountDto {
  return (
    object(value) &&
    text(value.id) &&
    typeof value.bankCode === 'string' &&
    CODES.includes(value.bankCode) &&
    (value.type === undefined || value.type === accountTypeOf(value.bankCode)) &&
    text(value.accountName) &&
    (value.label === null || text(value.label)) &&
    typeof value.accountNumberLast4 === 'string' &&
    /^\d{1,4}$/.test(value.accountNumberLast4) &&
    time(value.createdAt) &&
    time(value.updatedAt)
  )
}
const invalid = () =>
  new ApiError('server', 'Respons rekening tidak valid', { code: 'INVALID_RESPONSE' })
function account(value: unknown): BankAccountDto {
  if (!isBankAccount(value)) throw invalid()
  return withType(value)
}
const withType = (value: BankAccountDto): BankAccountDto => ({
  ...value,
  type: accountTypeOf(value.bankCode),
})
const path = (id: string) => `bank-accounts/${encodeURIComponent(id)}`

/**
 * Digits of an account number with spaces and dashes removed, or `null` when
 * it is not 6–20 digits. Same rule as the backend schema.
 */
export function normalizeAccountNumber(raw: string): string | null {
  if (!/^[0-9 -]+$/.test(raw)) return null
  const digits = raw.replace(/[ -]/g, '')
  return digits.length >= 6 && digits.length <= 20 ? digits : null
}

/**
 * An e-wallet phone number as the API stores it (`08…`, 10–13 digits), or
 * `null`. Accepts `0812…`, `62812…` and `+62 812…`. Same rule as the backend.
 */
export function normalizeWalletPhone(raw: string): string | null {
  if (!/^\+?[0-9 -]+$/.test(raw.trim())) return null
  const digits = raw.replace(/[ +-]/g, '')
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits
  return /^08\d{8,11}$/.test(local) ? local : null
}

export async function listBankAccounts(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<BankAccountPage> {
  const result = await apiRequest<unknown>('bank-accounts', {
    ...options,
    token,
    query: { cursor },
  })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(isBankAccount) ||
    !(result.nextCursor === null || text(result.nextCursor))
  )
    throw invalid()
  const page = result as unknown as BankAccountPage
  return { ...page, data: page.data.map(withType) }
}

export async function getBankAccount(id: string, token: string, options: ClientOptions = {}) {
  return account(await apiRequest<unknown>(path(id), { ...options, token }))
}

/** Never replayed automatically: a 401 or network failure goes back to the caller. */
export async function createBankAccount(
  input: CreateBankAccountInput,
  token: string,
  options: ClientOptions = {},
) {
  return account(
    await apiRequest<unknown>('bank-accounts', { ...options, method: 'POST', token, body: input }),
  )
}

export async function updateBankAccount(
  id: string,
  input: UpdateBankAccountInput,
  token: string,
  options: ClientOptions = {},
) {
  return account(
    await apiRequest<unknown>(path(id), { ...options, method: 'PATCH', token, body: input }),
  )
}

export async function deleteBankAccount(
  id: string,
  token: string,
  options: ClientOptions = {},
): Promise<void> {
  await apiRequest<void>(path(id), { ...options, method: 'DELETE', token })
}
