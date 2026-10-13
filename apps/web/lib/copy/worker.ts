import type { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'

const id = {
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
export type WorkerInvitationCopy = typeof id

const en: WorkerInvitationCopy = {
  title: 'Job invite',
  intro: 'Check the invite details before joining the company.',
  loading: 'Loading invite…',
  companyFallback: 'Inviting company',
  workerLabel: 'Invited as worker',
  salaryLabel: 'Reference monthly salary',
  salaryUnavailable: 'Not available',
  salaryHint:
    'Salary information from the company. Accepting the invite doesn’t start a pay stream yet.',
  expiresLabel: 'Valid until',
  pending: 'Waiting for acceptance',
  login: 'Sign in to continue',
  accountLoading: 'Loading account…',
  sessionLoading: 'Preparing session…',
  accept: 'Accept invite',
  accepting: 'Accepting invite…',
  retry: 'Try again',
  checkStatus: 'Check invite status',
  refreshProfile: 'Refresh profile',
  refreshing: 'Refreshing profile…',
  dashboard: 'Open dashboard',
  family: 'Open family invite',
  logout: 'Switch account',
  loggingOut: 'Signing out…',
  signedInAs: (name: string) => `Signed in as ${name}`,
  success: 'Invite accepted, profile not refreshed yet',
  successBody:
    'Your job is connected. Refresh your profile to continue without accepting the invite again.',
  errors: {
    'not-found': {
      title: 'Invite not found',
      message: 'Check the link or ask the sender for a new invite.',
    },
    used: {
      title: 'Invite already used',
      message: 'This link can’t be accepted again. Open the dashboard to see your account status.',
    },
    revoked: { title: 'Invite canceled', message: 'Ask the sender for a new invite.' },
    expired: { title: 'Invite expired', message: 'Ask the sender for a new invite.' },
    family: {
      title: 'This is a family invite',
      message: 'Use the family invite page to continue.',
    },
    self: {
      title: 'You can’t accept your own invite',
      message: 'Sign in with the account the invite is for.',
    },
    'already-linked': {
      title: 'Account already connected',
      message: 'You already work with this company. Open the dashboard to continue.',
    },
    unauthorized: {
      title: 'Your session needs a refresh',
      message: 'Refresh your session, then tap Accept invite again.',
    },
    'rate-limited': {
      title: 'Too many requests',
      message: 'Wait a moment before trying again.',
    },
    configuration: {
      title: 'Sign-in isn’t available yet',
      message: 'The app isn’t set up yet. Contact the app team.',
    },
    login: { title: 'Sign-in couldn’t open', message: 'Try again in a moment.' },
    session: {
      title: 'Trickle session isn’t ready',
      message: 'Wait for the wallet to be ready or try refreshing your session.',
    },
    logout: {
      title: 'Sign-out didn’t finish',
      message:
        'Your local Trickle session was cleared. Tap Switch account again if the account is still shown.',
    },
    network: {
      title: 'Acceptance not confirmed',
      message: 'Check the invite status before trying to accept again.',
    },
    load: { title: 'Invite couldn’t load', message: 'Check your connection and try again.' },
    server: {
      title: 'Invite couldn’t be accepted',
      message: 'Check the invite status before trying again.',
    },
  },
}

export const invitationCopy: Record<Locale, WorkerInvitationCopy> = { id: id, en: en }

export function invitationError(error: unknown, loading = false, locale: Locale = 'id') {
  const api = error as Partial<ApiError> | null
  const codes: Record<string, keyof WorkerInvitationCopy['errors']> = {
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
  return invitationCopy[locale].errors[key]
}
