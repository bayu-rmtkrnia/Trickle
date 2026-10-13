import type { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'
import { familyInvitationDictionary } from './family'

export const invitationCopy = {
  title: 'Undangan bergabung',
  intro: 'Periksa informasi undangan sebelum bergabung dengan perusahaan.',
  loading: 'Memuat undangan…',
  companyFallback: 'Perusahaan pengundang',
  workerLabel: 'Diundang sebagai worker',
  salaryLabel: 'Gaji referensi per bulan',
  salaryUnavailable: 'Tidak tersedia',
  salaryHint: 'Informasi gaji dari perusahaan. Penerimaan undangan belum membuat stream gaji.',
  expiresLabel: 'Berlaku hingga',
  pending: 'Menunggu penerimaan',
  login: 'Masuk untuk melanjutkan',
  accountLoading: 'Memuat akun…',
  sessionLoading: 'Menyiapkan sesi…',
  accept: 'Terima undangan',
  accepting: 'Menerima undangan…',
  retry: 'Coba lagi',
  checkStatus: 'Periksa status undangan',
  refreshProfile: 'Perbarui profil',
  refreshing: 'Memperbarui profil…',
  dashboard: 'Buka dashboard',
  family: 'Buka undangan keluarga',
  logout: 'Ganti akun',
  loggingOut: 'Sedang keluar…',
  signedInAs: (name: string) => `Masuk sebagai ${name}`,
  success: 'Undangan diterima, profil belum diperbarui',
  successBody:
    'Hubungan kerja sudah dibuat. Perbarui profil untuk melanjutkan tanpa menerima ulang undangan.',
  errors: {
    'not-found': {
      title: 'Undangan tidak ditemukan',
      message: 'Periksa tautan atau minta undangan baru kepada pengundang.',
    },
    used: {
      title: 'Undangan sudah digunakan',
      message: 'Tautan ini tidak dapat diterima lagi. Buka dashboard untuk melihat status akunmu.',
    },
    revoked: { title: 'Undangan dibatalkan', message: 'Minta undangan baru kepada pengundang.' },
    expired: { title: 'Undangan kedaluwarsa', message: 'Minta undangan baru kepada pengundang.' },
    family: {
      title: 'Ini undangan keluarga',
      message: 'Gunakan halaman undangan keluarga untuk melanjutkan.',
    },
    self: {
      title: 'Tidak dapat menerima undangan sendiri',
      message: 'Masuk menggunakan akun penerima undangan.',
    },
    'already-linked': {
      title: 'Akun sudah terhubung',
      message:
        'Kamu sudah memiliki hubungan kerja dengan perusahaan ini. Buka dashboard untuk melanjutkan.',
    },
    unauthorized: {
      title: 'Sesi perlu diperbarui',
      message: 'Perbarui sesi, lalu tekan Terima undangan kembali.',
    },
    'rate-limited': {
      title: 'Terlalu banyak permintaan',
      message: 'Tunggu sebentar sebelum mencoba lagi.',
    },
    configuration: {
      title: 'Login belum tersedia',
      message: 'Konfigurasi aplikasi belum siap. Hubungi pengelola aplikasi.',
    },
    login: { title: 'Login tidak dapat dibuka', message: 'Coba lagi dalam beberapa saat.' },
    session: {
      title: 'Sesi Trickle belum siap',
      message: 'Tunggu wallet siap atau coba perbarui sesi.',
    },
    logout: {
      title: 'Logout belum selesai',
      message:
        'Sesi lokal Trickle sudah dihapus. Coba Ganti akun kembali jika akun masih terlihat.',
    },
    network: {
      title: 'Status penerimaan belum terkonfirmasi',
      message: 'Periksa status undangan sebelum mencoba menerima kembali.',
    },
    load: { title: 'Undangan belum dapat dimuat', message: 'Periksa koneksi lalu coba lagi.' },
    server: {
      title: 'Undangan belum dapat diterima',
      message: 'Periksa status undangan sebelum mencoba lagi.',
    },
  },
}

export const workerInvitationDictionary: Record<Locale, typeof invitationCopy> = {
  id: invitationCopy,
  en: {
    ...invitationCopy,
    title: 'Join invitation',
    intro: 'Review the invitation before joining the company.',
    loading: 'Loading invitation…',
    companyFallback: 'Inviting company',
    workerLabel: 'Invited as worker',
    salaryLabel: 'Reference monthly salary',
    salaryUnavailable: 'Unavailable',
    salaryHint:
      'Salary information from the company. Accepting this invitation does not create a salary stream.',
    expiresLabel: 'Expires on',
    pending: 'Awaiting acceptance',
    login: 'Sign in to continue',
    accountLoading: 'Loading account…',
    sessionLoading: 'Preparing session…',
    accept: 'Accept invitation',
    accepting: 'Accepting invitation…',
    retry: 'Try again',
    checkStatus: 'Check invitation status',
    refreshProfile: 'Refresh profile',
    refreshing: 'Refreshing profile…',
    dashboard: 'Open dashboard',
    family: 'Open family invitation',
    logout: 'Switch account',
    loggingOut: 'Signing out…',
    signedInAs: (name) => `Signed in as ${name}`,
    success: 'Invitation accepted, profile not yet refreshed',
    successBody:
      'Your employment connection was created. Refresh your profile to continue without accepting again.',
    errors: {
      ...familyInvitationDictionary.en.errors,
      family: {
        title: 'This is a family invitation',
        message: 'Use the family invitation page to continue.',
      },
      'already-linked': {
        title: 'Account already connected',
        message:
          'You already have an employment connection with this company. Open the dashboard to continue.',
      },
    },
  },
}

export function invitationError(error: unknown, loading = false, locale: Locale = 'id') {
  const api = error as Partial<ApiError> | null
  const codes: Record<string, keyof typeof invitationCopy.errors> = {
    INVITE_NOT_FOUND: 'not-found',
    INVITE_ALREADY_ACCEPTED: 'used',
    INVITE_REVOKED: 'revoked',
    INVITE_EXPIRED: 'expired',
    CANNOT_ACCEPT_OWN_INVITE: 'self',
    ALREADY_LINKED: 'already-linked',
  }
  const key =
    (api?.code && codes[api.code]) ||
    (api?.status === 401
      ? 'unauthorized'
      : api?.status === 429
        ? 'rate-limited'
        : loading
          ? 'load'
          : api?.kind === 'network'
            ? 'network'
            : 'server')
  return workerInvitationDictionary[locale].errors[key]
}
