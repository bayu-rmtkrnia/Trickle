// Satu-satunya pintu data untuk komponen. Implementasi sekarang MOCK (./mock.ts);
// saat integrasi, isi fungsi diganti fetch ke backend dengan signature yang sama.

import { ApiError } from './errors'
import {
  DAY_MS,
  INVITE_TTL_DAYS,
  MOCK_ADDRESS,
  getStore,
  inviteUrl,
  newInviteCode,
  respond,
  withDerivedStatus,
} from './mock'
import type {
  CreateEmployerInput,
  CreateWorkerInviteInput,
  Employer,
  Invite,
  PayrollFund,
  Worker,
} from './types'

export type * from './types'
export { ApiError, isApiError } from './errors'
export { applyMockScenario, INVITE_TTL_DAYS } from './mock'

/** GET /employers/me. `null` kalau belum punya profil (backend: 404 EMPLOYER_NOT_FOUND). */
export function getEmployer(): Promise<Employer | null> {
  return respond(() => getStore().employer)
}

/** POST /employers */
export function createEmployer(input: CreateEmployerInput): Promise<Employer> {
  return respond(() => {
    const store = getStore()
    if (store.employer) throw new ApiError('conflict')
    store.employer = {
      id: `emp_${Date.now()}`,
      name: input.name,
      country: input.country,
      createdAt: new Date().toISOString(),
    }
    return store.employer
  }, 700)
}

/** GET /employers/me/workers */
export function listWorkers(): Promise<Worker[]> {
  return respond(() => [...getStore().workers].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt)))
}

/** Saldo dana payroll. Nanti dibaca dari kontrak. */
export function getPayrollFund(): Promise<PayrollFund> {
  return respond(() => getStore().fund)
}

/** GET /invites (yang dibuat user ini) */
export function listInvites(): Promise<Invite[]> {
  return respond(() =>
    getStore()
      .invites.map(withDerivedStatus)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )
}

/** POST /invites. Sekarang hanya undangan pekerja (scope employer). */
export function createInvite(input: CreateWorkerInviteInput): Promise<Invite> {
  return respond(() => {
    const store = getStore()
    if (!store.employer) throw new ApiError('unauthorized')
    const code = newInviteCode()
    const now = Date.now()
    const invite: Invite = {
      code,
      type: 'WORKER',
      status: 'PENDING',
      inviteeName: input.inviteeName,
      monthlySalaryUsd: input.monthlySalaryUsd,
      relation: null,
      invitedBy: { name: store.employer.name, address: MOCK_ADDRESS },
      url: inviteUrl('WORKER', code),
      expiresAt: new Date(now + INVITE_TTL_DAYS * DAY_MS).toISOString(),
      acceptedAt: null,
      createdAt: new Date(now).toISOString(),
    }
    store.invites = [invite, ...store.invites]
    return invite
  }, 700)
}

/**
 * Batalkan undangan yang masih menunggu.
 * Catatan: backend belum punya endpoint ini (status REVOKED sudah ada di skema).
 */
export function revokeInvite(code: string): Promise<Invite> {
  return respond(() => {
    const store = getStore()
    const invite = store.invites.find((i) => i.code === code)
    if (!invite) throw new ApiError('not-found')
    if (withDerivedStatus(invite).status !== 'PENDING') throw new ApiError('conflict')
    invite.status = 'REVOKED'
    return invite
  }, 600)
}
