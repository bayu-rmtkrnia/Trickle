// Implementasi ke backend `/api/v1`. Semua endpoint di sini butuh sesi
// (lihat ./session.ts); komponen memanggilnya lewat ./index.ts.

import { fetchAllPages } from './http'
import { authed, sessionCache } from './session'
import type {
  CreateEmployerInput,
  CreateWorkerInviteInput,
  Employer,
  Invite,
  Me,
  Page,
  PayrollFund,
  Worker,
} from './types'

interface CompanyDto extends Employer {
  ownerAddress: string
}

interface WorkerDto extends Worker {
  companyId: string
  userId: string
  address: string
  position: string | null
}

const COMPANY_ID = 'companyId'
const PAGE_SIZE = 100

const toEmployer = ({ id, name, country, createdAt }: CompanyDto): Employer => ({
  id,
  name,
  country,
  createdAt,
})

const toWorker = ({ id, displayName, monthlySalaryUsd, joinedAt }: WorkerDto): Worker => ({
  id,
  displayName,
  monthlySalaryUsd,
  joinedAt,
})

/** `companyId` milik user dari `GET /users/me`, di-cache per akun. */
async function companyId(): Promise<string | null> {
  const cached = sessionCache.get<string | null>(COMPANY_ID)
  if (cached !== undefined) return cached
  const me = await authed<Me>('users/me')
  sessionCache.set(COMPANY_ID, me.companyId)
  return me.companyId
}

async function requireCompanyId(): Promise<string> {
  const id = await companyId()
  if (!id) throw new Error('No company for this account')
  return id
}

export const realApi = {
  /** `null` kalau user belum punya perusahaan (arahkan ke onboarding). */
  async getEmployer(): Promise<Employer | null> {
    const id = await companyId()
    return id ? toEmployer(await authed<CompanyDto>(`companies/${id}`)) : null
  },

  async createEmployer(input: CreateEmployerInput): Promise<Employer> {
    const company = await authed<CompanyDto>('companies', { method: 'POST', body: input })
    sessionCache.set(COMPANY_ID, company.id)
    return toEmployer(company)
  },

  async listWorkers(): Promise<Worker[]> {
    const id = await requireCompanyId()
    const rows = await fetchAllPages((cursor) =>
      authed<Page<WorkerDto>>(`companies/${id}/workers`, {
        query: { limit: PAGE_SIZE, cursor },
      }),
    )
    return rows.map(toWorker)
  },

  /**
   * Saldo dana payroll dibaca dari kontrak, belum tersambung di sini. `null` =
   * belum tersedia; UI tidak menampilkan angka karangan.
   */
  async getPayrollFund(): Promise<PayrollFund | null> {
    return null
  },

  listInvites(): Promise<Invite[]> {
    return fetchAllPages((cursor) =>
      authed<Page<Invite>>('invites', {
        query: { type: 'WORKER', limit: PAGE_SIZE, cursor },
      }),
    )
  },

  createInvite(input: CreateWorkerInviteInput): Promise<Invite> {
    return authed<Invite>('invites', { method: 'POST', body: input })
  },

  async revokeInvite(id: string): Promise<void> {
    await authed<void>(`invites/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
