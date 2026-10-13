import { isApiError } from '@/lib/api/errors'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'

const id = {
  title: 'Dashboard worker',
  greeting: (name: string) => `Halo, ${name}`,
  fallbackName: 'Worker',
  loginTitle: 'Lihat pekerjaan dan payroll kamu',
  loginBody: 'Masuk dengan akun yang kamu gunakan untuk menerima undangan perusahaan.',
  login: 'Masuk',
  configuration: 'Login belum tersedia',
  configurationBody: 'Login belum dapat digunakan saat ini. Silakan coba kembali nanti.',
  loading: 'Memuat dashboard',
  sessionError: 'Sesi perlu diperbarui',
  sessionErrorBody: 'Perbarui sesi untuk memuat pekerjaan kamu kembali.',
  recover: 'Perbarui sesi',
  recovering: 'Memperbarui sesi...',
  walletMismatch: 'Wallet tidak sesuai dengan sesi',
  walletMismatchBody:
    'Alamat wallet aktif berbeda dari profil akun. Perbarui sesi atau keluar lalu masuk kembali dengan wallet yang sesuai.',
  logout: 'Keluar',
  loginError: 'Belum dapat membuka login',
  loginErrorBody: 'Silakan coba masuk kembali.',
  retry: 'Coba lagi',
  more: 'Muat pekerjaan lainnya',
  loadingMore: 'Memuat pekerjaan...',
  salaryLabel: 'Tersedia untuk ditarik',
  salaryUnavailable: 'Saldo belum tersedia',
  salaryBody: 'Saldo dan periode payroll akan ditampilkan setelah data payroll tersedia.',
  withdraw: 'Tarik gaji',
  withdrawHint: 'Penarikan belum tersedia saat ini.',
  employerTitle: 'Employer',
  employerBody: 'Perusahaan yang terhubung dengan akunmu.',
  employmentName: (name: string) => `Nama pekerja: ${name}`,
  joined: 'Bergabung',
  salaryReference: 'Gaji referensi',
  perMonth: (value: string) => `${value} / bulan`,
  salaryHint: 'Gaji referensi bulanan bukan saldo yang dapat ditarik.',
  payrollUnknown: 'Status payroll belum tersedia',
  emptyTitle: 'Belum ada pekerjaan terhubung',
  emptyBody:
    'Buka link undangan dari perusahaan dan terima undangannya untuk menghubungkan pekerjaanmu.',
  errors: {
    load: {
      title: 'Belum dapat memuat pekerjaan',
      message: 'Informasi pekerjaan belum dapat dimuat. Silakan coba lagi.',
    },
    page: {
      title: 'Pekerjaan berikutnya belum dapat dimuat',
      message: 'Pekerjaan yang sudah dimuat tetap ditampilkan. Silakan coba lagi.',
    },
    limit: {
      title: 'Terlalu banyak permintaan',
      message: 'Tunggu sebentar sebelum mencoba kembali.',
    },
    invalid: {
      title: 'Informasi pekerjaan belum dapat ditampilkan',
      message: 'Data yang diterima belum sesuai. Silakan coba lagi nanti.',
    },
  },
}

export type WorkerDashboardCopy = typeof id

const en: WorkerDashboardCopy = {
  ...id,
  title: 'Worker dashboard',
  greeting: (name) => `Hi, ${name}`,
  fallbackName: 'Worker',
  loginTitle: 'View your job and payroll',
  loginBody: 'Sign in with the account you used to accept the company invitation.',
  login: 'Sign in',
  configuration: 'Sign-in is unavailable',
  configurationBody: 'Sign-in cannot be used right now. Please try again later.',
  loading: 'Loading dashboard',
  sessionError: 'Your session needs refreshing',
  sessionErrorBody: 'Refresh your session to load your jobs again.',
  recover: 'Refresh session',
  recovering: 'Refreshing session…',
  walletMismatch: 'Wallet does not match this session',
  walletMismatchBody:
    'The active wallet address differs from the account profile. Refresh your session or sign in again with the correct wallet.',
  logout: 'Sign out',
  loginError: 'Could not open sign-in',
  loginErrorBody: 'Please try to sign in again.',
  retry: 'Try again',
  more: 'Load more jobs',
  loadingMore: 'Loading jobs…',
  salaryLabel: 'Available to withdraw',
  salaryUnavailable: 'Balance unavailable',
  salaryBody: 'Your payroll balance and period will appear once payroll data is available.',
  withdraw: 'Withdraw salary',
  withdrawHint: 'Withdrawal is not available right now.',
  employerTitle: 'Employer',
  employerBody: 'Companies connected to your account.',
  employmentName: (name) => `Worker name: ${name}`,
  joined: 'Joined',
  salaryReference: 'Reference salary',
  perMonth: (value) => `${value} / month`,
  salaryHint: 'The monthly reference salary is not your withdrawable balance.',
  payrollUnknown: 'Payroll status unavailable',
  emptyTitle: 'No jobs connected yet',
  emptyBody: 'Open and accept an invitation from a company to connect your job.',
  errors: {
    load: {
      title: 'Could not load jobs',
      message: 'Your job information could not be loaded. Please try again.',
    },
    page: {
      title: 'Could not load more jobs',
      message: 'Jobs already loaded remain visible. Please try again.',
    },
    limit: { title: 'Too many requests', message: 'Please wait a moment before trying again.' },
    invalid: {
      title: 'Job information unavailable',
      message: 'The data received is invalid. Please try again later.',
    },
  },
}

export const workerDashboardCopy: Record<Locale, WorkerDashboardCopy> = { id, en }

export function workerDashboardError(
  error: unknown,
  pagination = false,
  locale: Locale = DEFAULT_LOCALE,
) {
  const t = workerDashboardCopy[locale]
  if (isApiError(error) && error.status === 401)
    return { title: t.sessionError, message: t.sessionErrorBody }
  if (isApiError(error) && error.status === 429) return t.errors.limit
  if (isApiError(error) && error.code === 'INVALID_RESPONSE') return t.errors.invalid
  return pagination ? t.errors.page : t.errors.load
}
