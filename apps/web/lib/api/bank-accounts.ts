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
export type BankCode = (typeof BANK_CODES)[number]

/** Backend limit (`MAX_BANK_ACCOUNTS`); the server still enforces it. */
export const MAX_BANK_ACCOUNTS = 5

export interface BankAccountDto {
  id: string
  bankCode: BankCode
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
    BANK_CODES.includes(value.bankCode as BankCode) &&
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
  return value
}
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
  return result as unknown as BankAccountPage
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
