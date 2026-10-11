import { apiRequest, type ApiRequestOptions } from './client'
import { ApiError } from './errors'

/** Proposed Task 3 read contract; backend ownership and authorization remain with BE. */
export interface EmploymentDto {
  id: string
  displayName: string
  monthlySalaryUsd: number
  joinedAt: string
  employer: { id: string; name: string; country: string | null; ownerAddress: string }
}
export interface EmploymentPage {
  data: EmploymentDto[]
  nextCursor: string | null
}
type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0
function employment(value: unknown): value is EmploymentDto {
  return (
    object(value) &&
    text(value.id) &&
    text(value.displayName) &&
    typeof value.monthlySalaryUsd === 'number' &&
    Number.isFinite(value.monthlySalaryUsd) &&
    value.monthlySalaryUsd >= 0 &&
    text(value.joinedAt) &&
    Number.isFinite(Date.parse(value.joinedAt)) &&
    object(value.employer) &&
    text(value.employer.id) &&
    text(value.employer.name) &&
    (value.employer.country === null || text(value.employer.country)) &&
    text(value.employer.ownerAddress)
  )
}
export async function listMyEmployments(
  token: string,
  cursor?: string,
  options: ClientOptions = {},
): Promise<EmploymentPage> {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : ''
  const result = await apiRequest<unknown>(`users/me/employments${query}`, { ...options, token })
  if (
    !object(result) ||
    !Array.isArray(result.data) ||
    !result.data.every(employment) ||
    !(result.nextCursor === null || text(result.nextCursor))
  ) {
    throw new ApiError('server', 'Respons pekerjaan tidak valid', { code: 'INVALID_RESPONSE' })
  }
  return result as unknown as EmploymentPage
}
