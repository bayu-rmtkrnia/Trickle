import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import { ApiError } from '@/lib/api/errors'
export const withdrawCopy = {
  tokenFallback: 'token payroll',
  title: 'Tarik gaji',
  choose: 'Pilih payroll yang ingin ditarik',
  confirm: 'Konfirmasi penarikan',
  preparing: 'Memeriksa wallet dan gas...',
  retry: 'Coba lagi',
  close: 'Tutup',
  gross: 'Total perkiraan',
  worker: 'Bagian kamu',
  family: 'Bagian keluarga',
  recipient: (index: number, address: string) =>
    `Penerima ${index} (${address.slice(0, 6)}…${address.slice(-4)})`,
  estimate: 'Jumlah masih berupa perkiraan. Nilai akhirnya mengikuti transaksi yang dikonfirmasi.',
  demo: 'Ini token testnet untuk pengujian, tanpa nilai uang nyata.',
  stale: 'Perbarui payroll sebelum mengonfirmasi penarikan.',
  none: 'Belum ada saldo yang dapat ditarik.',
  stream: (id: string) => `Stream #${id}`,
  phases: {
    idle: 'Pilih payroll',
    confirming: 'Konfirmasi penarikan',
    signing: 'Menunggu persetujuan wallet',
    pending: 'Menunggu konfirmasi jaringan',
    success: 'Penarikan berhasil',
    failed: 'Penarikan belum berhasil',
    unknown: 'Status transaksi belum diketahui',
  },
  signing:
    'Selesaikan persetujuan di wallet Privy. Jangan mengirim penarikan lain selama proses ini.',
  pending:
    'Transaksi sudah dikirim. Kamu boleh menutup panel ini; statusnya tetap dapat diperiksa.',
  unknown:
    'Jangan mengirim ulang penarikan. Periksa transaksi yang sudah diajukan terlebih dahulu.',
  actual: 'Jumlah yang dikonfirmasi',
  check: 'Periksa status transaksi',
  verifyUnsent: 'Periksa permintaan belum dikirim',
  checking: 'Memeriksa transaksi...',
  explorer: 'Lihat transaksi di explorer',
  status: 'Lihat status penarikan',
  selectHint: 'Penarikan dilakukan satu payroll setiap kali.',
  recoveryLabel: 'Hash transaksi',
  recoveryHint: 'Salin hash transaksi penarikan dari explorer wallet untuk memeriksa hasilnya.',
  recoveryUnsent:
    'Gunakan pemeriksaan ini hanya jika kamu belum menyetujui transaksi di wallet. Periksa aktivitas wallet terlebih dahulu; aplikasi juga akan memeriksa jaringan sebelum membuka penarikan baru.',
  recoveryExplorer: 'Lihat aktivitas wallet di explorer',
  errorTitle: 'Penarikan belum dapat dilanjutkan',
}
export function withdrawalMessage(error: unknown): string {
  if (isRejected(error))
    return 'Persetujuan dibatalkan. Tidak ada penarikan baru yang dikonfirmasi.'
  const code =
    error instanceof WithdrawalError || error instanceof ApiError ? error.code : undefined
  const messages: Record<string, string> = {
    WALLET_NOT_READY:
      'Wallet belum dapat beralih ke jaringan payroll. Coba lagi sebelum mengirim transaksi.',
    DRIP_UNAVAILABLE: 'Layanan pendanaan gas belum dikonfigurasi. Penarikan belum dikirim.',
    DRIP_FAILED: 'Layanan pendanaan gas belum berhasil. Penarikan belum dikirim.',
    DRIP_DAILY_LIMIT: 'Batas pendanaan gas hari ini sudah tercapai. Coba lagi besok.',
    RATE_LIMITED: 'Terlalu banyak permintaan pendanaan gas. Tunggu sebentar lalu coba lagi.',
    UNAUTHORIZED: 'Sesi login berakhir. Masuk kembali sebelum menarik gaji.',
    NOTHING_TO_WITHDRAW: 'Belum ada saldo yang dapat ditarik. Perbarui payroll terlebih dahulu.',
    NOT_WORKER: 'Payroll ini tidak dimiliki wallet yang sedang digunakan.',
    WALLET_CHANGED: 'Akun atau wallet berubah. Buka kembali penarikan dari akun yang sesuai.',
    DEPLOYMENT_MISMATCH: 'Konfigurasi jaringan payroll belum sesuai.',
    GAS_INSUFFICIENT: 'Gas wallet belum cukup. Pendanaan gas perlu disiapkan sebelum penarikan.',
    GAS_FAILED: 'Pendanaan gas belum berhasil. Coba lagi setelah layanan tersedia.',
    GAS_PENDING: 'Pendanaan gas masih diproses. Coba lagi setelah transaksi gas dikonfirmasi.',
    REVERTED: 'Transaksi gagal di jaringan. Saldo tidak dianggap sudah ditarik.',
    REPLACED: 'Transaksi diganti atau dibatalkan. Penarikan ini belum dikonfirmasi.',
    TRANSACTION_MISMATCH:
      'Transaksi tersebut belum dapat dicocokkan dengan permintaan penarikan ini.',
    RECEIPT_UNVERIFIED:
      'Hasil transaksi belum dapat diverifikasi. Periksa status sebelum mengirim transaksi lain.',
    STORAGE_UNAVAILABLE:
      'Pemulihan transaksi di browser tidak tersedia. Periksa transaksi sebelum mencoba lagi.',
    INVALID_HASH: 'Masukkan hash transaksi yang valid dari explorer.',
    INVALID_REQUEST: 'Permintaan penarikan belum sesuai.',
    RECOVERY_UNVERIFIED:
      'Belum dapat memastikan permintaan ini tidak terkirim. Periksa aktivitas wallet atau masukkan hash transaksinya.',
    PENDING_CHANGED: 'Status penarikan berubah di tab lain. Muat ulang sebelum melanjutkan.',
    SIGNATURE_PENDING:
      'Persetujuan wallet untuk penarikan ini masih terbuka di tab lain. Selesaikan atau tutup di sana, lalu periksa lagi.',
    LOCK_UNAVAILABLE:
      'Browser ini belum mendukung penguncian antar-tab yang dibutuhkan untuk penarikan aman. Perbarui browser lalu coba lagi.',
  }
  if (code && messages[code]) return messages[code]!
  const value = error as {
    walk?: (predicate: (e: { data?: { errorName?: string } }) => boolean) => {
      data?: { errorName?: string }
    }
  }
  if (
    typeof value?.walk === 'function' &&
    value.walk((e) => e.data?.errorName === 'NothingToWithdraw')?.data?.errorName ===
      'NothingToWithdraw'
  )
    return messages.NOTHING_TO_WITHDRAW!
  return 'Layanan atau jaringan belum dapat menyelesaikan permintaan. Periksa status transaksi sebelum mencoba lagi.'
}
