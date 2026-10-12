import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export interface PayoutDto {
  id: string
  status: PayoutStatus
  /** What the transfer moved, as a decimal string (6 decimals). */
  amountUsd: string
  /** What the bank receives; authoritative once set. */
  amountIdr: number | null
  fxRate: number | null
  fxSource: string | null
  sourceTxHash: string
  bankAccount: { id: string; bankCode: string; accountNumberLast4: string }
  provider: string
  providerRef: string | null
  testMode: true
  failureReason: string | null
  createdAt: string
  updatedAt: string
}
export interface PayoutPage {
  data: PayoutDto[]
  nextCursor: string | null
}

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>
const STATUSES: PayoutStatus[] = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const nullableText = (value: unknown) => value === null || typeof value === 'string'
const time = (value: unknown) => text(value) && Number.isFinite(Date.parse(value))

export function isPayout(value: unknown): value is PayoutDto {
  return (
    object(value) &&
    text(value.id) &&
    STATUSES.includes(value.status as PayoutStatus) &&
    typeof value.amountUsd === 'string' &&
    /^\d+(?:\.\d+)?$/.test(value.amountUsd) &&
    (value.amountIdr === null ||
      (Number.isSafeInteger(value.amountIdr) && (value.amountIdr as number) >= 0)) &&
    (value.fxRate === null ||
      (typeof value.fxRate === 'number' && Number.isFinite(value.fxRate) && value.fxRate > 0)) &&
    nullableText(value.fxSource) &&
    typeof value.sourceTxHash === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(value.sourceTxHash) &&
    object(value.bankAccount) &&
    text(value.bankAccount.id) &&
    text(value.bankAccount.bankCode) &&
    typeof value.bankAccount.accountNumberLast4 === 'string' &&
    /^\d{1,4}$/.test(value.bankAccount.accountNumberLast4) &&
    text(value.provider) &&
    nullableText(value.providerRef) &&
    value.testMode === true &&
    nullableText(value.failureReason) &&
    time(value.createdAt) &&
    time(value.updatedAt)
  )
}
const invalid = () =>
  new ApiError('server', 'Respons pencairan tidak valid', { code: 'INVALID_RESPONSE' })
function payout(value: unknown) {
  if (!isPayout(value)) throw invalid()
  return value
}

/**
 * Registers a confirmed token transfer. Same hash again returns the first
 * payout (idempotent), so retrying with the same hash is safe; never retried
 * automatically here.
 */
export async function createPayout(
  input: { txHash: string; bankAccountId: string },
  token: string,
  options: ClientOptions = {},
) {
  return payout(
    await apiRequest<unknown>('payouts', { ...options, method: 'POST', token, body: input }),
  )
}

export async function getPayout(id: string, token: string, options: ClientOptions = {}) {
  return payout(
    await apiRequest<unknown>(`payouts/${encodeURIComponent(id)}`, { ...options, token }),
  )
}

export async function listPayouts(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<PayoutPage> {
  const result = await apiRequest<unknown>('payouts', { ...options, token, query: { cursor } })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(isPayout) ||
    !(result.nextCursor === null || text(result.nextCursor))
  )
    throw invalid()
  return result as unknown as PayoutPage
}
