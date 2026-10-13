import { isAddress } from 'viem'
import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

export interface MyStreamDto {
  id: string
  employerAddress: string
  workerAddress: string
  amountUnits: string
  withdrawnUnits: string
  refundedUnits: string
  startsAt: string
  endsAt: string
  status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELED'
  syncedAt: string
  company: { id: string; name: string } | null
}

export interface MyStreamPage {
  data: MyStreamDto[]
  nextCursor: string | null
}

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
const units = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value)
const streamId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9]\d{0,30}$/.test(value)
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value))

function stream(value: unknown): value is MyStreamDto {
  return (
    object(value) &&
    streamId(value.id) &&
    typeof value.employerAddress === 'string' &&
    isAddress(value.employerAddress) &&
    typeof value.workerAddress === 'string' &&
    isAddress(value.workerAddress) &&
    units(value.amountUnits) &&
    units(value.withdrawnUnits) &&
    units(value.refundedUnits) &&
    date(value.startsAt) &&
    date(value.endsAt) &&
    ['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELED'].includes(String(value.status)) &&
    date(value.syncedAt) &&
    (value.company === null ||
      (object(value.company) && text(value.company.id) && text(value.company.name)))
  )
}

const invalidResponse = () =>
  new ApiError('server', 'Respons payroll tidak valid', { code: 'INVALID_RESPONSE' })

export async function listMyStreams(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<MyStreamPage> {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
  const result = await apiRequest<unknown>(`users/me/streams${query}`, { ...options, token })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(stream) ||
    !(result.nextCursor === null || streamId(result.nextCursor))
  )
    throw invalidResponse()
  return result as unknown as MyStreamPage
}

export async function listAllMyStreamIds(
  token: string,
  options: ClientOptions = {},
): Promise<bigint[]> {
  const ids = new Map<string, bigint>()
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await listMyStreams(token, cursor, options)
    for (const item of page.data) ids.set(item.id, BigInt(item.id))
    if (page.nextCursor === null) break
    if (cursors.has(page.nextCursor)) throw invalidResponse()
    cursors.add(page.nextCursor)
    cursor = page.nextCursor
  } while (cursor)
  return [...ids.values()]
}
