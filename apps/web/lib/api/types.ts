// Bentuk data mengikuti respons backend (apps/api/src/routes). Saat integrasi,
// fungsi di ./index.ts diganti fetch; tipe dan komponen tidak berubah.

export type InviteType = 'WORKER' | 'FAMILY'
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface Invite {
  code: string
  type: InviteType
  status: InviteStatus
  inviteeName: string
  monthlySalaryUsd: number | null
  relation: string | null
  invitedBy: {
    /** Nama perusahaan untuk WORKER, nama pekerja untuk FAMILY. */
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

/** Saldo dana payroll employer. Nanti dibaca dari kontrak, bukan dari API. */
export interface PayrollFund {
  balanceUsd: number
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
