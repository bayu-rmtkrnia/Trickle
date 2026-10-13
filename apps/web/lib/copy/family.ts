import type { ApiError } from '@/lib/api/errors'
import { ChainReadError } from '@/lib/chain/types'
import type { Locale } from '@/lib/i18n/config'

const invitationId = {
  title: 'Undangan keluarga',
  intro: 'Periksa informasi undangan sebelum menerima sebagai keluarga.',
  loading: 'Memuat undangan…',
  inviterFallback: 'Pekerja pengundang',
  recipientLabel: 'Diundang sebagai keluarga',
  relationLabel: 'Hubungan',
  relationUnavailable: 'Tidak dicantumkan',
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
  dashboard: 'Buka dashboard keluarga',
  worker: 'Buka undangan worker',
  logout: 'Ganti akun',
  loggingOut: 'Sedang keluar…',
  signedInAs: (name: string) => `Masuk sebagai ${name}`,
  success: 'Undangan diterima, profil belum diperbarui',
  successBody:
    'Hubungan keluarga sudah dibuat. Perbarui profil untuk melanjutkan tanpa menerima ulang undangan.',
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
    worker: {
      title: 'Ini undangan worker',
      message: 'Gunakan halaman undangan worker untuk melanjutkan.',
    },
    self: {
      title: 'Tidak dapat menerima undangan sendiri',
      message: 'Masuk menggunakan akun penerima undangan.',
    },
    'already-linked': {
      title: 'Akun sudah terhubung',
      message:
        'Kamu sudah memiliki hubungan keluarga dengan worker ini. Buka dashboard untuk melanjutkan.',
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
export type FamilyInvitationCopy = typeof invitationId

const invitationEn: FamilyInvitationCopy = {
  title: 'Family invite',
  intro: 'Check the invite details before accepting as family.',
  loading: 'Loading invite…',
  inviterFallback: 'Inviting worker',
  recipientLabel: 'Invited as family',
  relationLabel: 'Relationship',
  relationUnavailable: 'Not specified',
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
  dashboard: 'Open family dashboard',
  worker: 'Open worker invite',
  logout: 'Switch account',
  loggingOut: 'Signing out…',
  signedInAs: (name: string) => `Signed in as ${name}`,
  success: 'Invite accepted, profile not refreshed yet',
  successBody:
    'You’re connected as family. Refresh your profile to continue without accepting the invite again.',
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
    worker: {
      title: 'This is a worker invite',
      message: 'Use the worker invite page to continue.',
    },
    self: {
      title: 'You can’t accept your own invite',
      message: 'Sign in with the account the invite is for.',
    },
    'already-linked': {
      title: 'Account already connected',
      message: 'You’re already connected as family to this worker. Open the dashboard to continue.',
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

export const invitationCopy: Record<Locale, FamilyInvitationCopy> = {
  id: invitationId,
  en: invitationEn,
}

export function invitationError(error: unknown, loading = false, locale: Locale = 'id') {
  const api = error as Partial<ApiError> | null
  const codes: Record<string, keyof FamilyInvitationCopy['errors']> = {
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

const dashboardId = {
  title: 'Dashboard keluarga',
  greeting: (name: string) => `Halo, ${name}`,
  fallbackName: 'Keluarga',
  loading: 'Memuat dashboard',
  loginTitle: 'Lihat dana yang kamu terima',
  loginBody: 'Masuk dengan akun yang kamu gunakan untuk menerima undangan keluarga.',
  login: 'Masuk',
  loginError: 'Belum dapat membuka login',
  loginErrorBody: 'Silakan coba masuk kembali.',
  configuration: 'Login belum tersedia',
  configurationBody: 'Login belum dapat digunakan saat ini. Silakan coba kembali nanti.',
  sessionError: 'Sesi perlu diperbarui',
  sessionErrorBody: 'Perbarui sesi untuk memuat dashboard keluarga kembali.',
  recover: 'Perbarui sesi',
  recovering: 'Memperbarui sesi...',
  walletMismatch: 'Wallet tidak sesuai dengan sesi',
  walletMismatchBody:
    'Alamat wallet aktif berbeda dari profil akun. Perbarui sesi atau keluar lalu masuk kembali dengan wallet yang sesuai.',
  logout: 'Keluar',
  notRecipientTitle: 'Akun belum terhubung sebagai keluarga',
  notRecipientBody:
    'Buka tautan undangan keluarga dari pekerja, lalu terima undangannya untuk mengaktifkan dashboard ini.',
  balanceLabel: 'Dana diterima',
  idrEstimate: (value: string) => `≈ ${value}`,
  idrUnavailable: 'Rupiah belum tersedia',
  rateLoading: 'Memuat kurs...',
  balanceUnavailable: 'Saldo belum tersedia',
  demo: 'Aset demo',
  demoHint: 'Token testnet untuk pengujian, tanpa nilai uang nyata.',
  balanceLoading: 'Membaca saldo di jaringan...',
  balanceReady: 'Saldo dari block terakhir',
  balanceStale: 'Data saldo tertunda',
  balanceEmpty: 'Belum ada dana diterima',
  details: 'Info detail',
  detailsTitle: 'Rincian dana',
  tokenAmount: 'Jumlah token',
  idrLabel: 'Estimasi rupiah',
  rateLabel: 'Kurs USD/IDR',
  rateSource: 'Sumber kurs',
  rateTime: 'Waktu kurs',
  rateTimeUnknown: 'Tidak diketahui',
  readTime: 'Saldo dibaca',
  block: 'Block',
  rateSources: { live: 'Langsung', cache: 'Tersimpan', fallback: 'Cadangan' },
  fallbackHint: 'Kurs cadangan dipakai karena penyedia kurs belum dapat dihubungi.',
  estimateHint:
    'Rupiah hanya perkiraan. Nilai pencairan ditentukan saat pencairan diproses (mode uji).',
  emptyHint: 'Dana muncul di sini setelah pekerja menarik gaji yang dibagikan ke wallet kamu.',
  staleHint:
    'Menampilkan saldo pada block terakhir yang berhasil dibaca. Perbarui untuk membaca ulang.',
  refresh: 'Perbarui saldo',
  refreshing: 'Memperbarui saldo...',
  actionsTitle: 'Pencairan',
  actionsPending: 'Pencairan belum tersedia di versi ini.',
  payout: 'Cairkan',
  history: 'Riwayat',
  errors: {
    read: {
      title: 'Belum dapat membaca saldo',
      message: 'Jaringan belum dapat dihubungi. Coba perbarui saldo.',
    },
    configuration: {
      title: 'Konfigurasi jaringan belum sesuai',
      message: 'Wallet atau konfigurasi jaringan belum dapat digunakan untuk membaca saldo.',
    },
    consistency: {
      title: 'Data saldo perlu dibaca ulang',
      message: 'Data jaringan berubah saat dimuat. Perbarui saldo untuk data yang konsisten.',
    },
  },
}
export type FamilyDashboardCopy = typeof dashboardId

const dashboardEn: FamilyDashboardCopy = {
  title: 'Family dashboard',
  greeting: (name: string) => `Hi, ${name}`,
  fallbackName: 'Family',
  loading: 'Loading dashboard',
  loginTitle: 'See the money you’ve received',
  loginBody: 'Sign in with the account you used to accept the family invite.',
  login: 'Sign in',
  loginError: 'Couldn’t open sign-in',
  loginErrorBody: 'Please try signing in again.',
  configuration: 'Sign-in isn’t available yet',
  configurationBody: 'Sign-in can’t be used right now. Please try again later.',
  sessionError: 'Your session needs a refresh',
  sessionErrorBody: 'Refresh your session to load the family dashboard again.',
  recover: 'Refresh session',
  recovering: 'Refreshing session...',
  walletMismatch: 'Wallet doesn’t match your session',
  walletMismatchBody:
    'The active wallet address is different from your account profile. Refresh your session, or sign out and sign in again with the right wallet.',
  logout: 'Sign out',
  notRecipientTitle: 'Account isn’t connected as family yet',
  notRecipientBody:
    'Open the family invite link from the worker and accept it to turn on this dashboard.',
  balanceLabel: 'Money received',
  idrEstimate: (value: string) => `≈ ${value}`,
  idrUnavailable: 'Rupiah not available yet',
  rateLoading: 'Loading exchange rate...',
  balanceUnavailable: 'Balance not available yet',
  demo: 'Demo asset',
  demoHint: 'Testnet token for testing, with no real money value.',
  balanceLoading: 'Reading balance from the network...',
  balanceReady: 'Balance from the latest block',
  balanceStale: 'Balance data is delayed',
  balanceEmpty: 'No money received yet',
  details: 'Details',
  detailsTitle: 'Fund details',
  tokenAmount: 'Token amount',
  idrLabel: 'Estimated rupiah',
  rateLabel: 'USD/IDR rate',
  rateSource: 'Rate source',
  rateTime: 'Rate time',
  rateTimeUnknown: 'Unknown',
  readTime: 'Balance read at',
  block: 'Block',
  rateSources: { live: 'Live', cache: 'Cached', fallback: 'Fallback' },
  fallbackHint: 'A fallback rate is used because the rate provider can’t be reached.',
  estimateHint:
    'Rupiah is only an estimate. The cash-out amount is set when the cash-out is processed (test mode).',
  emptyHint: 'Money shows up here after the worker withdraws pay that’s shared to your wallet.',
  staleHint: 'Showing the balance from the last block that was read. Refresh to read it again.',
  refresh: 'Refresh balance',
  refreshing: 'Refreshing balance...',
  actionsTitle: 'Cash out',
  actionsPending: 'Cash-out isn’t available in this version.',
  payout: 'Cash out',
  history: 'History',
  errors: {
    read: {
      title: 'Couldn’t read balance',
      message: 'The network can’t be reached. Try refreshing your balance.',
    },
    configuration: {
      title: 'Network setup doesn’t match',
      message: 'The wallet or network setup can’t be used to read your balance.',
    },
    consistency: {
      title: 'Balance data needs a re-read',
      message: 'Network data changed while loading. Refresh your balance for consistent data.',
    },
  },
}

export const familyDashboardCopy: Record<Locale, FamilyDashboardCopy> = {
  id: dashboardId,
  en: dashboardEn,
}

export function familyBalanceError(error: unknown, phase?: string, locale: Locale = 'id') {
  const errors = familyDashboardCopy[locale].errors
  if (phase === 'unconfigured') return errors.configuration
  if (error instanceof ChainReadError) {
    if (['DEPLOYMENT_MISMATCH', 'INVALID_WALLET'].includes(error.code)) return errors.configuration
    if (['CHAIN_CHANGED', 'SNAPSHOT_MISMATCH'].includes(error.code)) return errors.consistency
  }
  return errors.read
}

/** Display names for the official bank codes. Presentation only. */
export const bankNames: Record<string, string> = {
  BCA: 'BCA',
  BNI: 'BNI',
  BRI: 'BRI',
  MANDIRI: 'Mandiri',
  BSI: 'BSI',
  CIMB: 'CIMB Niaga',
  PERMATA: 'Permata',
  DANAMON: 'Danamon',
  BTN: 'BTN',
  OCBC: 'OCBC',
}

const bankId = {
  title: 'Rekening bank',
  body: 'Rekening tujuan pencairan. Nomor lengkap hanya disimpan terenkripsi di server.',
  loading: 'Memuat rekening...',
  add: 'Tambah rekening',
  limit: (max: number) => `Maksimal ${max} rekening. Hapus salah satu untuk menambah.`,
  emptyTitle: 'Belum ada rekening',
  emptyBody: 'Tambahkan rekening bank untuk menerima pencairan mode uji.',
  retry: 'Coba lagi',
  more: 'Muat rekening lainnya',
  loadingMore: 'Memuat rekening...',
  masked: (last4: string) => `•••• ${last4}`,
  edit: 'Ubah',
  remove: 'Hapus',
  editLabel: (bank: string, last4: string) => `Ubah rekening ${bank} ${last4}`,
  removeLabel: (bank: string, last4: string) => `Hapus rekening ${bank} ${last4}`,
  form: {
    addTitle: 'Tambah rekening',
    editTitle: 'Ubah rekening',
    editHint: 'Bank dan nomor tidak dapat diubah. Tambah rekening baru untuk nomor lain.',
    bank: 'Bank',
    bankPlaceholder: 'Pilih bank',
    number: 'Nomor rekening',
    numberHint: '6–20 digit. Spasi dan tanda hubung diabaikan.',
    name: 'Nama pemilik rekening',
    label: 'Label (opsional)',
    labelHint: 'Contoh: Rekening utama',
    save: 'Simpan rekening',
    saving: 'Menyimpan...',
    bankRequired: 'Pilih bank.',
    numberInvalid: 'Nomor rekening harus 6–20 digit.',
    nameInvalid: 'Nama pemilik harus 2–100 karakter.',
    labelInvalid: 'Label maksimal 40 karakter.',
  },
  delete: {
    title: 'Hapus rekening?',
    body: (bank: string, last4: string) =>
      `Rekening ${bank} •••• ${last4} tidak dapat dipilih lagi untuk pencairan. Riwayat pencairan tetap tersimpan.`,
    confirm: 'Hapus rekening',
    confirming: 'Menghapus...',
    cancel: 'Batal',
  },
  errors: {
    exists: {
      title: 'Rekening sudah ditambahkan',
      message: 'Rekening dengan bank dan nomor ini sudah ada di daftar.',
    },
    limit: {
      title: 'Batas rekening tercapai',
      message: 'Hapus salah satu rekening sebelum menambah yang baru.',
    },
    unavailable: {
      title: 'Rekening bank belum tersedia',
      message: 'Penyimpanan rekening belum dikonfigurasi di server. Coba lagi nanti.',
    },
    validation: {
      title: 'Data rekening belum sesuai',
      message: 'Periksa kembali nomor, nama, dan label rekening.',
    },
    session: {
      title: 'Sesi perlu diperbarui',
      message: 'Perbarui sesi, lalu simpan kembali. Perubahan belum dikirim ulang otomatis.',
    },
    forbidden: {
      title: 'Akun belum dapat mengelola rekening',
      message: 'Terima undangan keluarga terlebih dahulu.',
    },
    notFound: {
      title: 'Rekening tidak ditemukan',
      message: 'Rekening ini sudah dihapus. Daftar telah diperbarui.',
    },
    rate: { title: 'Terlalu banyak permintaan', message: 'Tunggu sebentar sebelum mencoba lagi.' },
    network: {
      title: 'Status penyimpanan belum terkonfirmasi',
      message: 'Muat ulang daftar rekening sebelum mencoba lagi agar tidak tersimpan dua kali.',
    },
    load: {
      title: 'Rekening belum dapat dimuat',
      message: 'Periksa koneksi lalu coba lagi.',
    },
    page: {
      title: 'Rekening berikutnya belum dapat dimuat',
      message: 'Rekening yang sudah dimuat tetap ditampilkan.',
    },
    server: {
      title: 'Permintaan belum berhasil',
      message: 'Coba lagi dalam beberapa saat.',
    },
  },
}
export type BankCopy = typeof bankId

const bankEn: BankCopy = {
  title: 'Bank accounts',
  body: 'Where cash-outs are sent. The full number is only stored encrypted on the server.',
  loading: 'Loading accounts...',
  add: 'Add account',
  limit: (max: number) => `Up to ${max} accounts. Remove one to add another.`,
  emptyTitle: 'No accounts yet',
  emptyBody: 'Add a bank account to receive test-mode cash-outs.',
  retry: 'Try again',
  more: 'Load more accounts',
  loadingMore: 'Loading accounts...',
  masked: (last4: string) => `•••• ${last4}`,
  edit: 'Edit',
  remove: 'Remove',
  editLabel: (bank: string, last4: string) => `Edit ${bank} account ${last4}`,
  removeLabel: (bank: string, last4: string) => `Remove ${bank} account ${last4}`,
  form: {
    addTitle: 'Add account',
    editTitle: 'Edit account',
    editHint: 'The bank and number can’t be changed. Add a new account for a different number.',
    bank: 'Bank',
    bankPlaceholder: 'Choose a bank',
    number: 'Account number',
    numberHint: '6–20 digits. Spaces and dashes are ignored.',
    name: 'Account holder name',
    label: 'Label (optional)',
    labelHint: 'For example: Main account',
    save: 'Save account',
    saving: 'Saving...',
    bankRequired: 'Choose a bank.',
    numberInvalid: 'The account number must be 6–20 digits.',
    nameInvalid: 'The holder name must be 2–100 characters.',
    labelInvalid: 'The label can be at most 40 characters.',
  },
  delete: {
    title: 'Remove account?',
    body: (bank: string, last4: string) =>
      `The ${bank} •••• ${last4} account can no longer be chosen for cash-outs. Your cash-out history is kept.`,
    confirm: 'Remove account',
    confirming: 'Removing...',
    cancel: 'Cancel',
  },
  errors: {
    exists: {
      title: 'Account already added',
      message: 'An account with this bank and number is already in the list.',
    },
    limit: {
      title: 'Account limit reached',
      message: 'Remove one account before adding a new one.',
    },
    unavailable: {
      title: 'Bank accounts aren’t available yet',
      message: 'Account storage isn’t set up on the server yet. Try again later.',
    },
    validation: {
      title: 'Account details don’t look right',
      message: 'Check the number, name and label again.',
    },
    session: {
      title: 'Your session needs a refresh',
      message: 'Refresh your session, then save again. Changes aren’t resent automatically.',
    },
    forbidden: {
      title: 'This account can’t manage bank accounts',
      message: 'Accept the family invite first.',
    },
    notFound: {
      title: 'Account not found',
      message: 'This account was already removed. The list has been updated.',
    },
    rate: { title: 'Too many requests', message: 'Wait a moment before trying again.' },
    network: {
      title: 'Save not confirmed',
      message: 'Reload the account list before trying again, so it isn’t saved twice.',
    },
    load: {
      title: 'Accounts couldn’t load',
      message: 'Check your connection and try again.',
    },
    page: {
      title: 'Couldn’t load more accounts',
      message: 'Accounts already loaded are still shown.',
    },
    server: {
      title: 'Request didn’t go through',
      message: 'Try again in a moment.',
    },
  },
}

export const bankCopy: Record<Locale, BankCopy> = { id: bankId, en: bankEn }

export function bankError(
  error: unknown,
  context: 'load' | 'page' | 'mutation' = 'mutation',
  locale: Locale = 'id',
) {
  const e = bankCopy[locale].errors
  const api = error as Partial<ApiError> | null
  if (api?.code === 'BANK_ACCOUNT_EXISTS') return e.exists
  if (api?.code === 'BANK_ACCOUNT_LIMIT') return e.limit
  if (api?.code === 'BANK_ACCOUNTS_UNAVAILABLE' || api?.status === 503) return e.unavailable
  if (api?.status === 401) return e.session
  if (api?.status === 403) return e.forbidden
  if (api?.status === 404) return e.notFound
  if (api?.status === 422 || api?.status === 400) return e.validation
  if (api?.status === 429) return e.rate
  if (context === 'load') return e.load
  if (context === 'page') return e.page
  return api?.kind === 'network' ? e.network : e.server
}
