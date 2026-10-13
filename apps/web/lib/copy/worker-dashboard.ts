import { isApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'

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
  title: 'Worker dashboard',
  greeting: (name: string) => `Hi, ${name}`,
  fallbackName: 'Worker',
  loginTitle: 'See your jobs and pay',
  loginBody: 'Sign in with the account you used to accept your company’s invite.',
  login: 'Sign in',
  configuration: 'Sign-in isn’t available yet',
  configurationBody: 'Sign-in can’t be used right now. Please try again later.',
  loading: 'Loading dashboard',
  sessionError: 'Your session needs a refresh',
  sessionErrorBody: 'Refresh your session to load your jobs again.',
  recover: 'Refresh session',
  recovering: 'Refreshing session...',
  walletMismatch: 'Wallet doesn’t match your session',
  walletMismatchBody:
    'The active wallet address is different from your account profile. Refresh your session, or sign out and sign in again with the right wallet.',
  logout: 'Sign out',
  loginError: 'Couldn’t open sign-in',
  loginErrorBody: 'Please try signing in again.',
  retry: 'Try again',
  more: 'Load more jobs',
  loadingMore: 'Loading jobs...',
  salaryLabel: 'Available to withdraw',
  salaryUnavailable: 'Balance not available yet',
  salaryBody: 'Your balance and pay period will appear once your payroll data is available.',
  withdraw: 'Withdraw pay',
  withdrawHint: 'Withdrawals aren’t available right now.',
  employerTitle: 'Employer',
  employerBody: 'Companies connected to your account.',
  employmentName: (name: string) => `Worker name: ${name}`,
  joined: 'Joined',
  salaryReference: 'Reference salary',
  perMonth: (value: string) => `${value} / month`,
  salaryHint: 'The monthly reference salary is not a balance you can withdraw.',
  payrollUnknown: 'Payroll status not available yet',
  emptyTitle: 'No jobs connected yet',
  emptyBody: 'Open the invite link from your company and accept it to connect your job.',
  errors: {
    load: {
      title: 'Couldn’t load your jobs',
      message: 'Your job details couldn’t be loaded. Please try again.',
    },
    page: {
      title: 'Couldn’t load more jobs',
      message: 'Jobs already loaded are still shown. Please try again.',
    },
    limit: {
      title: 'Too many requests',
      message: 'Wait a moment before trying again.',
    },
    invalid: {
      title: 'Job details can’t be shown',
      message: 'The data received doesn’t look right. Please try again later.',
    },
  },
}

export const workerDashboardCopy: Record<Locale, WorkerDashboardCopy> = { id: id, en: en }

export function workerDashboardError(error: unknown, pagination = false, locale: Locale = 'id') {
  const t = workerDashboardCopy[locale]
  if (isApiError(error) && error.status === 401)
    return { title: t.sessionError, message: t.sessionErrorBody }
  if (isApiError(error) && error.status === 429) return t.errors.limit
  if (isApiError(error) && error.code === 'INVALID_RESPONSE') return t.errors.invalid
  return pagination ? t.errors.page : t.errors.load
}
