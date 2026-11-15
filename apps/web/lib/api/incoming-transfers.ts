import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

/** One `SplitPaid` event: part of a family member's withdrawal paid to this wallet. */
export interface IncomingTransferDto {
  id: string
  /** The withdrawal transaction. */
  txHash: string
  streamId: string
  /** Lowercased address of the worker who sent it. */
  workerAddress: string
  /** Token base units (6 decimals), as a decimal string. */
  amountUnits: string
  /** Block time of the withdrawal. */
  paidAt: string
  /** `null` when the sender has no Trickle account. */
  sender: { id: string; displayName: string | null } | null
}
export interface IncomingTransferPage {
  data: IncomingTransferDto[]
  nextCursor: string | null
}

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function isIncomingTransfer(value: unknown): value is IncomingTransferDto {
  return (
    object(value) &&
    text(value.id) &&
    typeof value.txHash === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(value.txHash) &&
    typeof value.streamId === 'string' &&
    /^\d+$/.test(value.streamId) &&
    typeof value.workerAddress === 'string' &&
    /^0x[0-9a-fA-F]{40}$/.test(value.workerAddress) &&
    typeof value.amountUnits === 'string' &&
    /^\d+$/.test(value.amountUnits) &&
    text(value.paidAt) &&
    Number.isFinite(Date.parse(value.paidAt)) &&
    (value.sender === null ||
      (object(value.sender) &&
        text(value.sender.id) &&
        (value.sender.displayName === null || typeof value.sender.displayName === 'string')))
  )
}

/** `GET /users/me/incoming-transfers`: newest first, one page. */
export async function listIncomingTransfers(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<IncomingTransferPage> {
  const result = await apiRequest<unknown>('users/me/incoming-transfers', {
    ...options,
    token,
    query: { cursor },
  })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(isIncomingTransfer) ||
    !(result.nextCursor === null || text(result.nextCursor))
  )
    throw new ApiError('server', 'Respons kiriman masuk tidak valid', { code: 'INVALID_RESPONSE' })
  return result as unknown as IncomingTransferPage
}
