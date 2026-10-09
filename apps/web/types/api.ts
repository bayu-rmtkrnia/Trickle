// API v1 contract: apps/api/openapi.json and the backend route DTOs.
// Dates remain ISO strings; these are transport types, not business models.
export interface ApiErrorResponse {
  error: { code: string; message: string; details?: unknown }
}

export interface ValidationErrorDetail {
  field: string
  message: string
}

export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
}

export interface PageQuery {
  /** Backend default: 20; allowed range: 1–100. */
  limit?: number
  /** Opaque nextCursor from the previous response; omit for the first page. */
  cursor?: string
}

export interface Employer {
  id: string
  name: string
  country: string | null
  ownerAddress: string
  createdAt: string
}

export interface CreateEmployerInput {
  /** Trimmed by backend, 2–100 characters. */
  name: string
  /** Two-letter country code; backend converts it to uppercase. */
  country?: string
}
export type UpdateEmployerInput = Partial<CreateEmployerInput>

export interface Worker {
  /** EmployerWorker relationship ID, not the User ID. */
  id: string
  displayName: string
  address: string
  /** Metadata only: this is not a stream or withdrawable balance. */
  monthlySalaryUsd: number
  joinedAt: string
}

export type InviteType = 'WORKER' | 'FAMILY'
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface Invite {
  // Backend returns code, not the database invite ID.
  code: string
  type: InviteType
  status: InviteStatus
  inviteeName: string
  monthlySalaryUsd: number | null
  relation: string | null
  invitedBy: { name: string | null; address: string }
  url: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export type CreateInviteInput =
  | { type: 'WORKER'; inviteeName: string; monthlySalaryUsd: number }
  | { type: 'FAMILY'; inviteeName: string; relation?: string }

export interface ListInvitesQuery extends PageQuery {
  type?: InviteType
}

export interface FxQuote {
  base: 'USD'
  quote: 'IDR'
  rate: number
  source: 'live' | 'cache' | 'fallback'
  rateTime: string | null
  fetchedAt: string | null
}
