import { isApiError } from '@/lib/api/errors'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'

export const payoutCopy = {
  title: 'Cairkan ke rekening',
  testMode: 'Mode uji',
  testModeHint:
    'Token mAUSD dikirim sungguhan di testnet. Transfer bank disimulasikan oleh provider uji, bukan transfer bank nyata.',
  open: 'Cairkan',
  status: 'Lihat status pencairan',
  notConfigured: 'Pencairan belum dikonfigurasi',
  notConfiguredBody:
    'Alamat tujuan pencairan belum diatur untuk environment ini. Token tidak dapat dikirim.',
  noBank: 'Tambahkan rekening bank terlebih dahulu untuk mencairkan dana.',
  noBalance: 'Belum ada dana yang dapat dicairkan.',
  bank: 'Rekening tujuan',
  amount: 'Jumlah mAUSD',
  amountHint: (max: string) => `Saldo tersedia: ${max}`,
  max: 'Semua',
  estimate: 'Perkiraan diterima',
  estimateHint:
    'Perkiraan dari kurs saat ini. Jumlah rupiah final ditentukan server saat pencairan diproses.',
  rateUnavailable: 'Kurs belum tersedia; jumlah rupiah ditentukan server.',
  confirm: 'Kirim dan cairkan',
  preparing: 'Memeriksa saldo, rekening, dan gas...',
  cancel: 'Batal',
  close: 'Tutup',
  done: 'Selesai',
  explorer: 'Lihat transfer token di explorer',
  hash: 'Hash transfer token',
  amountErrors: {
    empty: 'Masukkan jumlah.',
    invalid: 'Gunakan angka, misalnya 12,5.',
    precision: 'Maksimal 6 angka di belakang koma.',
    zero: 'Jumlah harus lebih dari 0.',
    balance: 'Jumlah melebihi saldo.',
  },
  bankRequired: 'Pilih rekening tujuan.',
  phases: {
    idle: 'Cairkan ke rekening',
    confirming: 'Konfirmasi pencairan',
    signing: 'Menunggu persetujuan wallet',
    'transfer-pending': 'Menunggu konfirmasi transfer token',
    'submission-unknown': 'Status transfer token belum diketahui',
    'registration-pending': 'Token terkirim, pencairan belum terdaftar',
    processing: 'Pencairan sedang diproses',
    completed: 'Pencairan selesai',
    'transfer-failed': 'Transfer token gagal',
    'payout-failed': 'Pencairan bank gagal',
  },
  bodies: {
    signing: 'Setujui transfer di wallet Privy. Jangan mengirim pencairan lain selama proses ini.',
    'transfer-pending':
      'Transfer token sudah dikirim. Kamu boleh menutup panel ini; statusnya tetap diperiksa.',
    'submission-unknown':
      'Jangan mengirim ulang. Periksa transfer yang sudah diajukan terlebih dahulu.',
    'registration-pending':
      'Token sudah sampai di alamat pencairan. Daftarkan ulang dengan hash yang sama; tidak ada transfer baru.',
    processing: 'Provider uji sedang memproses transfer bank. Status diperbarui otomatis.',
    completed: 'Provider uji menandai transfer bank selesai.',
    'transfer-failed': 'Transfer token gagal di jaringan. Saldo tidak dianggap terkirim.',
    'payout-failed':
      'Token sudah terkirim tetapi pencairan bank tidak berhasil. Token tidak dikembalikan otomatis; tim perlu menyelesaikannya secara manual dengan hash transfer ini.',
  },
  retryRegistration: 'Daftarkan ulang pencairan',
  registering: 'Mendaftarkan pencairan...',
  check: 'Periksa transfer',
  checking: 'Memeriksa transfer...',
  recoveryLabel: 'Hash transaksi (opsional)',
  recoveryHint: 'Tempel hash transfer dari explorer wallet bila status tidak ditemukan.',
  recoveryExplorer: 'Lihat aktivitas wallet di explorer',
  verifyUnsent: 'Periksa bahwa transfer belum dikirim',
  unreadableTitle: 'Data pemulihan tidak dapat dibaca',
  unreadableBody:
    'Browser menyimpan catatan pencairan yang rusak atau dari jaringan lain, jadi aplikasi tidak dapat memastikan apakah transfer sebelumnya terkirim. Buka aktivitas wallet di explorer dan pastikan tidak ada transfer mAUSD yang belum tercatat.',
  unreadableHash: 'Hash yang masih terbaca dari catatan',
  unreadableConfirm:
    'Saya sudah memeriksa aktivitas wallet di explorer. Transfer yang sudah terkirim tetap harus didaftarkan atau dilaporkan ke tim.',
  discard: 'Hapus data pemulihan',
  verifyUnsentHint:
    'Gunakan hanya jika kamu tidak menyetujui transfer di wallet. Aplikasi memeriksa jaringan dulu.',
  changeBank: 'Gunakan rekening ini',
  changeBankTitle: 'Rekening tujuan tidak ditemukan',
  changeBankBody:
    'Token sudah terkirim. Pilih rekening lain untuk hash transfer yang sama; tidak ada transfer baru.',
  sentAmount: 'Token dikirim',
  receivedIdr: 'Diterima (dari server)',
  rate: 'Kurs yang dipakai',
  provider: 'Provider',
  reference: 'Referensi provider',
  account: 'Rekening',
  failureReason: 'Alasan',
  errorTitle: 'Pencairan belum dapat dilanjutkan',
}

const messages: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Saldo token tidak cukup untuk jumlah ini. Perbarui saldo.',
  INVALID_REQUEST: 'Permintaan pencairan belum sesuai.',
  DEPLOYMENT_MISMATCH: 'Konfigurasi jaringan atau token belum sesuai. Token belum dikirim.',
  GAS_INSUFFICIENT: 'Gas wallet belum cukup. Token belum dikirim.',
  GAS_FAILED: 'Pendanaan gas belum berhasil. Token belum dikirim.',
  GAS_PENDING: 'Pendanaan gas masih diproses. Coba lagi sebentar lagi.',
  DRIP_UNAVAILABLE: 'Layanan pendanaan gas belum dikonfigurasi. Token belum dikirim.',
  DRIP_FAILED: 'Layanan pendanaan gas belum berhasil. Token belum dikirim.',
  DRIP_DAILY_LIMIT: 'Batas pendanaan gas hari ini sudah tercapai. Coba lagi besok.',
  WALLET_CHANGED: 'Akun atau wallet berubah. Buka kembali pencairan dari akun yang sesuai.',
  WALLET_NOT_READY: 'Wallet belum dapat beralih ke jaringan. Token belum dikirim.',
  NOT_RECIPIENT: 'Akun ini belum terhubung sebagai keluarga. Token belum dikirim.',
  REVERTED: 'Transfer token gagal di jaringan.',
  REPLACED: 'Transfer diganti atau dibatalkan di wallet. Pencairan ini belum terkonfirmasi.',
  TRANSACTION_MISMATCH: 'Transaksi tersebut tidak cocok dengan pencairan ini.',
  RECEIPT_UNVERIFIED: 'Transfer belum dapat diverifikasi. Periksa sebelum mengirim lagi.',
  INVALID_HASH: 'Masukkan hash transaksi yang valid dari explorer.',
  STORAGE_UNAVAILABLE:
    'Data pemulihan pencairan di browser tidak dapat dibaca. Periksa aktivitas wallet di explorer sebelum mengirim lagi.',
  PENDING_MISMATCH:
    'Ada data pencairan dari konfigurasi jaringan lain. Pencairan baru ditahan agar tidak terkirim dua kali.',
  PENDING_CHANGED: 'Status pencairan berubah di tab lain. Muat ulang sebelum melanjutkan.',
  RECOVERY_UNVERIFIED:
    'Belum dapat memastikan transfer tidak terkirim. Periksa aktivitas wallet atau masukkan hash transaksinya.',
  PAYOUT_MISMATCH: 'Respons pencairan tidak cocok dengan transfer ini. Coba daftarkan ulang.',
  TX_PENDING: 'Transfer belum dikonfirmasi server. Daftarkan ulang sebentar lagi.',
  CHAIN_UNAVAILABLE: 'Server belum dapat memeriksa transfer. Daftarkan ulang sebentar lagi.',
  PAYOUTS_UNAVAILABLE:
    'Pencairan belum dikonfigurasi di server. Token aman; daftarkan ulang setelah layanan siap.',
  TX_FAILED: 'Server menyatakan transfer gagal. Simpan hash dan hubungi tim.',
  TX_NOT_A_PAYOUT:
    'Server tidak mengenali transfer ini sebagai pencairan (alamat tujuan berbeda). Simpan hash dan hubungi tim.',
  PAYOUT_EXISTS: 'Transfer ini sudah dipakai akun lain. Simpan hash dan hubungi tim.',
  BANK_ACCOUNT_NOT_FOUND: 'Rekening tujuan tidak ditemukan. Pilih rekening lain.',
  UNAUTHORIZED: 'Sesi login berakhir. Perbarui sesi; transfer tidak dikirim ulang.',
  RATE_LIMITED: 'Terlalu banyak permintaan. Tunggu sebentar.',
  INVALID_RESPONSE: 'Respons server belum sesuai. Coba lagi.',
}

export function payoutMessage(error: unknown): string {
  if (isRejected(error)) return 'Persetujuan dibatalkan. Token tidak dikirim.'
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && messages[code]) return messages[code]
  if (isApiError(error)) {
    if (error.status === 401) return messages.UNAUTHORIZED!
    if (error.status === 404) return messages.BANK_ACCOUNT_NOT_FOUND!
    if (error.status === 429) return messages.RATE_LIMITED!
  }
  return 'Layanan atau jaringan belum dapat menyelesaikan permintaan. Periksa status sebelum mencoba lagi.'
}
