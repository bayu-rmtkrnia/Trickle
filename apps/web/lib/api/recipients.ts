import { isAddress, type Address } from 'viem'
import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

/** `Recipient` in apps/api/openapi.json. The split percentage lives on-chain. */
export interface RecipientDto {
  id: string
  ownerId: string
  userId: string
  /** Pass this address as `recipient` to `setSplits`. */
  address: Address
  displayName: string
  relation: string | null
  addedAt: string
}
export interface RecipientPage {
  data: RecipientDto[]
  nextCursor: string | null
}

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function isRecipient(value: unknown): value is RecipientDto {
  return (
    object(value) &&
    text(value.id) &&
    text(value.ownerId) &&
    text(value.userId) &&
    typeof value.address === 'string' &&
    isAddress(value.address) &&
    text(value.displayName) &&
    (value.relation === null || text(value.relation)) &&
    text(value.addedAt) &&
    Number.isFinite(Date.parse(value.addedAt))
  )
}
const invalid = () =>
  new ApiError('server', 'Respons penerima tidak valid', { code: 'INVALID_RESPONSE' })

export async function listRecipients(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<RecipientPage> {
  const result = await apiRequest<unknown>('recipients', { ...options, token, query: { cursor } })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(isRecipient) ||
    !(result.nextCursor === null || text(result.nextCursor))
  )
    throw invalid()
  return result as unknown as RecipientPage
}

/**
 * Soft delete. 409 `SPLIT_ACTIVE` while the on-chain split still pays this
 * recipient: change the split first. Never retried automatically.
 */
export async function deleteRecipient(
  id: string,
  token: string,
  options: ClientOptions = {},
): Promise<void> {
  await apiRequest<void>(`recipients/${encodeURIComponent(id)}`, {
    ...options,
    method: 'DELETE',
    token,
  })
}
