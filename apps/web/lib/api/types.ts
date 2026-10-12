// Bentuk data mengikuti respons backend `/api/v1` (apps/api/src/modules).
// "Employer" di UI = "Company" di backend.

export type InviteType = 'WORKER' | 'RECIPIENT'
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface Invite {
  /** Dipakai untuk membatalkan undangan (`DELETE /invites/{id}`). */
  id: string
  code: string
  type: InviteType
  status: InviteStatus
  inviteeName: string
  monthlySalaryUsd: number | null
  relation: string | null
  invitedBy: {
    /** Nama perusahaan untuk WORKER, nama pekerja untuk RECIPIENT. */
    name: string | null
    /** Alamat akun pengundang. Jangan pernah ditampilkan ke pengguna. */
    address: string
  }
  url: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export interface Employer {
  id: string
  name: string
  /** ISO 3166-1 alpha-2, mis. "MY". */
  country: string | null
  createdAt: string
}

export interface Worker {
  id: string
  displayName: string
  monthlySalaryUsd: number
  joinedAt: string
}

/** Saldo dana payroll employer. Dibaca dari kontrak, bukan dari API. */
export interface PayrollFund {
  balanceUsd: number
}

export interface Me {
  id: string
  address: string
  displayName: string | null
  createdAt: string
  /** Perusahaan aktif milik user; `null` kalau belum jadi employer. */
  companyId: string | null
  roles: { employer: boolean; worker: boolean; recipient: boolean }
}

export interface Page<T> {
  data: T[]
  nextCursor: string | null
}

export interface CreateEmployerInput {
  name: string
  country: string
}

export interface CreateWorkerInviteInput {
  type: 'WORKER'
  inviteeName: string
  monthlySalaryUsd: number
}
