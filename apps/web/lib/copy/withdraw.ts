import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'
const id = {
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
export type WithdrawCopy = typeof id

const en: WithdrawCopy = {
  tokenFallback: 'payroll token',
  title: 'Withdraw pay',
  choose: 'Choose the payroll to withdraw',
  confirm: 'Confirm withdrawal',
  preparing: 'Checking wallet and gas...',
  retry: 'Try again',
  close: 'Close',
  gross: 'Estimated total',
  worker: 'Your share',
  family: 'Family share',
  recipient: (index: number, address: string) =>
    `Recipient ${index} (${address.slice(0, 6)}…${address.slice(-4)})`,
  estimate: 'These amounts are estimates. The final amount follows the confirmed transaction.',
  demo: 'This is a testnet token for testing, with no real money value.',
  stale: 'Refresh payroll before confirming the withdrawal.',
  none: 'Nothing available to withdraw yet.',
  stream: (id: string) => `Stream #${id}`,
  phases: {
    idle: 'Choose payroll',
    confirming: 'Confirm withdrawal',
    signing: 'Waiting for wallet approval',
    pending: 'Waiting for network confirmation',
    success: 'Withdrawal complete',
    failed: 'Withdrawal didn’t go through',
    unknown: 'Transaction status unknown',
  },
  signing: 'Finish the approval in your Privy wallet. Don’t send another withdrawal meanwhile.',
  pending: 'The transaction was sent. You can close this panel; its status can still be checked.',
  unknown: 'Don’t send the withdrawal again. Check the transaction you already submitted first.',
  actual: 'Confirmed amount',
  check: 'Check transaction status',
  verifyUnsent: 'Check the request wasn’t sent',
  checking: 'Checking transaction...',
  explorer: 'View transaction in explorer',
  status: 'View withdrawal status',
  selectHint: 'Withdrawals are made one payroll at a time.',
  recoveryLabel: 'Transaction hash',
  recoveryHint:
    'Copy the withdrawal transaction hash from your wallet explorer to check the result.',
  recoveryUnsent:
    'Only use this check if you didn’t approve the transaction in your wallet. Check your wallet activity first; the app also checks the network before opening a new withdrawal.',
  recoveryExplorer: 'View wallet activity in explorer',
  errorTitle: 'Withdrawal can’t continue',
}

export const withdrawCopy: Record<Locale, WithdrawCopy> = { id: id, en: en }
export function withdrawalMessage(error: unknown, locale: Locale = 'id'): string {
  if (locale === 'en') return withdrawalMessageEn(error)
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

const withdrawalMessagesEn: Record<string, string> = {
  WALLET_NOT_READY: 'Your wallet couldn’t switch to the payroll network. Try again before sending.',
  DRIP_UNAVAILABLE: 'Gas funding isn’t set up yet. The withdrawal wasn’t sent.',
  DRIP_FAILED: 'Gas funding didn’t work. The withdrawal wasn’t sent.',
  DRIP_DAILY_LIMIT: 'Today’s gas funding limit was reached. Try again tomorrow.',
  RATE_LIMITED: 'Too many gas funding requests. Wait a moment and try again.',
  UNAUTHORIZED: 'Your session ended. Sign in again before withdrawing.',
  NOTHING_TO_WITHDRAW: 'Nothing available to withdraw yet. Refresh payroll first.',
  NOT_WORKER: 'This payroll doesn’t belong to the wallet in use.',
  WALLET_CHANGED: 'Your account or wallet changed. Reopen the withdrawal from the right account.',
  DEPLOYMENT_MISMATCH: 'The payroll network setup doesn’t match.',
  GAS_INSUFFICIENT: 'Not enough gas in your wallet. Gas funding is needed before withdrawing.',
  GAS_FAILED: 'Gas funding didn’t work. Try again once the service is available.',
  GAS_PENDING: 'Gas funding is still processing. Try again once it’s confirmed.',
  REVERTED: 'The transaction failed on the network. Nothing counts as withdrawn.',
  REPLACED: 'The transaction was replaced or canceled. This withdrawal isn’t confirmed.',
  TRANSACTION_MISMATCH: 'That transaction doesn’t match this withdrawal request.',
  RECEIPT_UNVERIFIED:
    'The transaction result couldn’t be verified. Check its status before sending another.',
  STORAGE_UNAVAILABLE:
    'Transaction recovery isn’t available in this browser. Check the transaction before trying again.',
  INVALID_HASH: 'Enter a valid transaction hash from the explorer.',
  INVALID_REQUEST: 'The withdrawal request isn’t valid.',
  RECOVERY_UNVERIFIED:
    'We couldn’t confirm this request wasn’t sent. Check your wallet activity or enter its transaction hash.',
  PENDING_CHANGED: 'The withdrawal status changed in another tab. Reload before continuing.',
  SIGNATURE_PENDING:
    'A wallet approval for this withdrawal is still open in another tab. Finish or close it there, then check again.',
  LOCK_UNAVAILABLE:
    'This browser doesn’t support the cross-tab lock needed for safe withdrawals. Update your browser and try again.',
}

function withdrawalMessageEn(error: unknown): string {
  if (isRejected(error)) return 'Approval canceled. No new withdrawal was confirmed.'
  const code =
    error instanceof WithdrawalError || error instanceof ApiError ? error.code : undefined
  if (code && withdrawalMessagesEn[code]) return withdrawalMessagesEn[code]!
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
    return withdrawalMessagesEn.NOTHING_TO_WITHDRAW!
  return 'The service or network couldn’t finish the request. Check the transaction status before trying again.'
}
