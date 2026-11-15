import { isAddress } from 'viem'
import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

/** `POST /demo-streams`: a real testnet salary stream from the demo employer to the caller. */
export interface DemoStream {
  id: string
  workerAddress: string
  amountUsd: string
  durationSeconds: number
  status: 'PENDING' | 'SENT' | 'FAILED'
  streamId: string | null
  txHash: string | null
  startsAt: string | null
  endsAt: string | null
  alreadyStarted: boolean
  createdAt: string
}

export async function startDemoStream(
  token: string,
  address: string,
  options: Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'> = {},
): Promise<DemoStream> {
  const value = await apiRequest<DemoStream>('demo-streams', { ...options, token, method: 'POST' })
  if (
    !value ||
    typeof value.id !== 'string' ||
    typeof value.workerAddress !== 'string' ||
    !isAddress(value.workerAddress) ||
    value.workerAddress.toLowerCase() !== address.toLowerCase() ||
    typeof value.amountUsd !== 'string' ||
    !/^\d+(?:\.\d+)?$/.test(value.amountUsd) ||
    typeof value.durationSeconds !== 'number' ||
    !['PENDING', 'SENT', 'FAILED'].includes(value.status) ||
    typeof value.alreadyStarted !== 'boolean' ||
    (value.status === 'SENT' && !value.streamId)
  )
    throw new ApiError('server', 'Respons demo tidak valid', { code: 'INVALID_RESPONSE' })
  return value
}
