import type { ApiError } from '@/lib/api/errors'
import { ChainReadError } from '@/lib/chain/types'

export const invitationCopy = {
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

export function invitationError(error: unknown, loading = false) {
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
  return invitationCopy.errors[key]
}

export const familyDashboardCopy = {
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

export function familyBalanceError(error: unknown, phase?: string) {
  const errors = familyDashboardCopy.errors
  if (phase === 'unconfigured') return errors.configuration
  if (error instanceof ChainReadError) {
    if (['DEPLOYMENT_MISMATCH', 'INVALID_WALLET'].includes(error.code)) return errors.configuration
    if (['CHAIN_CHANGED', 'SNAPSHOT_MISMATCH'].includes(error.code)) return errors.consistency
  }
  return errors.read
}
