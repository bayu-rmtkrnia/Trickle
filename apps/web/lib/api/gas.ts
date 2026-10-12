import { isAddress, type Hex } from 'viem'
import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'
export interface GasDrip {
  address: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  amountMon: string
  txHash: Hex | null
  alreadyDripped: boolean
  createdAt: string
}
export async function requestGas(
  token: string,
  address: string,
  options: Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'> = {},
): Promise<GasDrip> {
  const value = await apiRequest<GasDrip>('gas/drip', { ...options, token, method: 'POST' })
  if (
    !value ||
    typeof value.address !== 'string' ||
    !isAddress(value.address) ||
    value.address.toLowerCase() !== address.toLowerCase() ||
    !['PENDING', 'SENT', 'FAILED'].includes(value.status) ||
    typeof value.amountMon !== 'string' ||
    !/^\d+(?:\.\d+)?$/.test(value.amountMon) ||
    typeof value.alreadyDripped !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    (value.txHash !== null && !/^0x[0-9a-f]{64}$/i.test(value.txHash)) ||
    (value.status === 'SENT' && !value.txHash)
  )
    throw new ApiError('server', 'Respons gas tidak valid', { code: 'INVALID_RESPONSE' })
  return value
}
