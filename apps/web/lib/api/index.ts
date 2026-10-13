// Satu-satunya pintu data untuk komponen. Memakai backend (`./real.ts`),
// kecuali saat pratinjau state development (`?state=`) yang memakai `./mock.ts`.

import { isMockMode, mockApi } from './mock'
import { realApi } from './real'
import type {
  CompanyStream,
  CreateEmployerInput,
  CreateWorkerInviteInput,
  Employer,
  Invite,
  Worker,
} from './types'

export type * from './types'
export { ApiError, isApiError, type ApiErrorKind } from './errors'
export { applyMockScenario, isMockMode, INVITE_TTL_DAYS, mockFunding } from './mock'

const impl = () => (isMockMode() ? mockApi : realApi)

/** `null` kalau belum punya profil perusahaan. */
export const getEmployer = (): Promise<Employer | null> => impl().getEmployer()

export const createEmployer = (input: CreateEmployerInput): Promise<Employer> =>
  impl().createEmployer(input)

export const listWorkers = (): Promise<Worker[]> => impl().listWorkers()

/** Aliran gaji (stream) perusahaan, dari indexer backend. */
export const listStreams = (): Promise<CompanyStream[]> => impl().listStreams()

/** Undangan pekerja yang dibuat user ini. */
export const listInvites = (): Promise<Invite[]> => impl().listInvites()

export const createInvite = (input: CreateWorkerInviteInput): Promise<Invite> =>
  impl().createInvite(input)

/** Batalkan undangan yang masih menunggu, berdasarkan `invite.id`. */
export const revokeInvite = (id: string): Promise<void> => impl().revokeInvite(id)
