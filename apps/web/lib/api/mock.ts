// Data MOCK untuk pratinjau state saat development (`?state=`). Hanya aktif
// setelah sebuah skenario dipasang; tanpa itu semua fungsi memakai backend.
// Disimpan di memori: tetap ada selama pindah halaman, hilang saat reload.

import type { EmployerState } from '@/lib/dev-state'
import { ApiError } from './errors'
import type {
  CreateEmployerInput,
  CreateWorkerInviteInput,
  Employer,
  Invite,
  PayrollFund,
  Worker,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000
export const INVITE_TTL_DAYS = 14
const MOCK_ADDRESS = '0x0000000000000000000000000000000000000001'

type Store = {
  employer: Employer | null
  workers: Worker[]
  invites: Invite[]
  fund: PayrollFund
  /** `loading` = request tidak pernah selesai; `network` = semua request gagal. */
  mode: 'normal' | 'loading' | 'network'
}

const daysAgo = (d: number) => new Date(Date.now() - d * DAY_MS).toISOString()

function inviteUrl(type: Invite['type'], code: string) {
  const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin
  return `${origin}/${type === 'WORKER' ? 'w' : 'f'}/invite/${code}`
}

const COMPANY = 'PT. Mencari Cinta Sejati'

function workerInvite(
  code: string,
  inviteeName: string,
  monthlySalaryUsd: number,
  createdDaysAgo: number,
  status: Invite['status'] = 'PENDING',
): Invite {
  const createdAt = daysAgo(createdDaysAgo)
  return {
    id: `inv_${code}`,
    code,
    type: 'WORKER',
    status,
    inviteeName,
    monthlySalaryUsd,
    relation: null,
    invitedBy: { name: COMPANY, address: MOCK_ADDRESS },
    url: inviteUrl('WORKER', code),
    expiresAt: new Date(new Date(createdAt).getTime() + INVITE_TTL_DAYS * DAY_MS).toISOString(),
    acceptedAt: status === 'ACCEPTED' ? daysAgo(createdDaysAgo - 1) : null,
    createdAt,
  }
}

function fixture(state: EmployerState): Store {
  const employer: Employer = { id: 'emp_1', name: COMPANY, country: 'MY', createdAt: daysAgo(30) }
  // Total $2.400/bulan = $80/hari.
  const workers: Worker[] = [
    { id: 'ew_1', displayName: 'Raka Bagus Samudra', monthlySalaryUsd: 800, joinedAt: daysAgo(6) },
    { id: 'ew_2', displayName: 'Siti Aminah', monthlySalaryUsd: 750, joinedAt: daysAgo(20) },
    { id: 'ew_3', displayName: 'Dewi Lestari', monthlySalaryUsd: 850, joinedAt: daysAgo(2) },
  ]
  const invites: Invite[] = [
    workerInvite('BUDI7K2Q', 'Budi Santoso', 700, 2),
    workerInvite('ANIR4M8P', 'Ani Rahmawati', 650, 10),
    workerInvite('RAKA2H9X', 'Raka Bagus Samudra', 800, 7, 'ACCEPTED'),
    workerInvite('JOKO5T3W', 'Joko Prasetyo', 700, 5, 'REVOKED'),
    workerInvite('RINA8V6N', 'Rina Wulandari', 700, 20),
  ]
  const base: Store = { employer, workers, invites, fund: { balanceUsd: 1800 }, mode: 'normal' }

  switch (state) {
    case 'loading':
      return { ...base, mode: 'loading' }
    case 'network-error':
      return { ...base, mode: 'network' }
    case 'belum-ada-profil':
      return { ...base, employer: null, workers: [], invites: [], fund: { balanceUsd: 0 } }
    case 'belum-ada-pekerja':
      return { ...base, workers: [], invites: [], fund: { balanceUsd: 500 } }
    case 'runway-rendah':
      return { ...base, fund: { balanceUsd: 400 } }
    case 'runway-kritis':
      return { ...base, fund: { balanceUsd: 160 } }
    case 'dana-habis':
      return { ...base, fund: { balanceUsd: 0 } }
    default:
      return base
  }
}

let store: Store | null = null
let appliedState: EmployerState | undefined

/**
 * Pasang skenario dev. Setelah dipasang, mode mock bertahan sampai halaman
 * di-reload, supaya alur (mis. onboarding → dashboard) tetap nyambung.
 */
export function applyMockScenario(state: EmployerState | undefined) {
  if (!state || state === appliedState) return
  appliedState = state
  store = fixture(state)
}

export const isMockMode = () => store !== null

function getStore(): Store {
  if (!store) throw new Error('Mock mode is not active')
  return store
}

/** Jeda seperti jaringan sungguhan, plus mode loading/error dari skenario. */
async function respond<T>(value: () => T, ms = 450): Promise<T> {
  if (getStore().mode === 'loading') return new Promise<T>(() => {})
  await new Promise((r) => setTimeout(r, ms))
  if (getStore().mode === 'network') throw new ApiError('network')
  return value()
}

/** Status EXPIRED dihitung dari tanggal, sama seperti backend. */
function withDerivedStatus(invite: Invite): Invite {
  return invite.status === 'PENDING' && new Date(invite.expiresAt).getTime() < Date.now()
    ? { ...invite, status: 'EXPIRED' }
    : invite
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newInviteCode() {
  return Array.from(
    { length: 8 },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)],
  ).join('')
}

export const mockApi = {
  getEmployer: () => respond(() => getStore().employer),

  createEmployer: (input: CreateEmployerInput) =>
    respond(() => {
      const s = getStore()
      if (s.employer) throw new ApiError('conflict', 'conflict', 409, 'COMPANY_EXISTS')
      s.employer = {
        id: `emp_${Date.now()}`,
        name: input.name,
        country: input.country,
        createdAt: new Date().toISOString(),
      }
      return s.employer
    }, 700),

  listWorkers: () =>
    respond(() => [...getStore().workers].sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))),

  getPayrollFund: () => respond((): PayrollFund | null => getStore().fund),

  listInvites: () =>
    respond(() =>
      getStore()
        .invites.map(withDerivedStatus)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    ),

  createInvite: (input: CreateWorkerInviteInput) =>
    respond(() => {
      const s = getStore()
      if (!s.employer) throw new ApiError('forbidden')
      const invite: Invite = {
        ...workerInvite(newInviteCode(), input.inviteeName, input.monthlySalaryUsd, 0),
        invitedBy: { name: s.employer.name, address: MOCK_ADDRESS },
      }
      s.invites = [invite, ...s.invites]
      return invite
    }, 700),

  revokeInvite: (id: string) =>
    respond(() => {
      const invite = getStore().invites.find((i) => i.id === id)
      if (!invite) throw new ApiError('not-found')
      if (withDerivedStatus(invite).status !== 'PENDING') throw new ApiError('conflict')
      invite.status = 'REVOKED'
    }, 600),
}
