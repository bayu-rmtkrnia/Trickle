import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import { ApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'
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
export const withdrawDictionary: Record<Locale, typeof withdrawCopy> = {
  id: withdrawCopy,
  en: {
    tokenFallback: 'payroll token',
    title: 'Withdraw salary',
    choose: 'Choose a payroll stream to withdraw',
    confirm: 'Confirm withdrawal',
    preparing: 'Checking wallet and gas…',
    retry: 'Try again',
    close: 'Close',
    gross: 'Estimated total',
    worker: 'Your share',
    family: 'Family share',
    recipient: (index, address) =>
      `Recipient ${index} (${address.slice(0, 6)}…${address.slice(-4)})`,
    estimate: 'Amounts are estimates. Final amounts follow the confirmed transaction.',
    demo: 'Testnet token for testing only. It has no real monetary value.',
    stale: 'Refresh payroll before confirming a withdrawal.',
    none: 'Nothing available to withdraw yet.',
    stream: (id) => `Stream #${id}`,
    phases: {
      idle: 'Choose payroll',
      confirming: 'Confirm withdrawal',
      signing: 'Waiting for wallet approval',
      pending: 'Waiting for network confirmation',
      success: 'Withdrawal successful',
      failed: 'Withdrawal did not succeed',
      unknown: 'Transaction status unknown',
    },
    signing:
      'Approve the transaction in your Privy wallet. Do not submit another withdrawal while this is in progress.',
    pending: 'The transaction was sent. You can close this panel; its status can still be checked.',
    unknown: 'Do not submit the withdrawal again. Check the existing transaction first.',
    actual: 'Confirmed amount',
    check: 'Check transaction status',
    verifyUnsent: 'Check that the request was not sent',
    checking: 'Checking transaction…',
    explorer: 'View transaction in explorer',
    status: 'View withdrawal status',
    selectHint: 'Withdraw from one payroll stream at a time.',
    recoveryLabel: 'Transaction hash',
    recoveryHint: 'Copy the withdrawal hash from your wallet explorer to check the result.',
    recoveryUnsent:
      'Use this check only if you did not approve the transaction in your wallet. Check wallet activity first; the app also checks the network before allowing another withdrawal.',
    recoveryExplorer: 'View wallet activity in explorer',
    errorTitle: 'Withdrawal cannot continue yet',
  },
}
export function withdrawalMessage(error: unknown, locale: Locale = 'id'): string {
  if (isRejected(error))
    return locale === 'en'
      ? 'Approval was canceled. No new withdrawal was confirmed.'
      : 'Persetujuan dibatalkan. Tidak ada penarikan baru yang dikonfirmasi.'
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
  if (code && messages[code])
    return locale === 'en'
      ? (withdrawalErrorEnglish[code] ?? withdrawalErrorEnglish.default!)
      : messages[code]!
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
    return locale === 'en'
      ? withdrawalErrorEnglish.NOTHING_TO_WITHDRAW!
      : messages.NOTHING_TO_WITHDRAW!
  return locale === 'en'
    ? withdrawalErrorEnglish.default!
    : 'Layanan atau jaringan belum dapat menyelesaikan permintaan. Periksa status transaksi sebelum mencoba lagi.'
}

const withdrawalErrorEnglish: Record<string, string> = {
  WALLET_NOT_READY: 'The wallet could not switch to the payroll network. Try again before sending.',
  DRIP_UNAVAILABLE: 'Gas funding is not configured. The withdrawal was not sent.',
  DRIP_FAILED: 'Gas funding failed. The withdrawal was not sent.',
  DRIP_DAILY_LIMIT: 'The daily gas funding limit was reached. Try again tomorrow.',
  RATE_LIMITED: 'Too many gas funding requests. Wait and try again.',
  UNAUTHORIZED: 'Your session expired. Sign in again before withdrawing.',
  NOTHING_TO_WITHDRAW: 'Nothing is available to withdraw. Refresh payroll first.',
  NOT_WORKER: 'This payroll stream does not belong to the active wallet.',
  WALLET_CHANGED: 'The account or wallet changed. Open withdrawal again from the correct account.',
  DEPLOYMENT_MISMATCH: 'Payroll network configuration does not match.',
  GAS_INSUFFICIENT: 'The wallet has insufficient gas. Gas funding is needed before withdrawal.',
  GAS_FAILED: 'Gas funding failed. Try again once it is available.',
  GAS_PENDING: 'Gas funding is still processing. Try again after confirmation.',
  REVERTED: 'The transaction failed on-chain. The balance is not marked as withdrawn.',
  REPLACED: 'The transaction was replaced or canceled. This withdrawal is not confirmed.',
  TRANSACTION_MISMATCH: 'This transaction does not match the withdrawal request.',
  RECEIPT_UNVERIFIED:
    'The transaction result could not be verified. Check status before sending another.',
  STORAGE_UNAVAILABLE:
    'Browser transaction recovery is unavailable. Check the transaction before trying again.',
  INVALID_HASH: 'Enter a valid transaction hash from the explorer.',
  INVALID_REQUEST: 'The withdrawal request is invalid.',
  RECOVERY_UNVERIFIED:
    'The app cannot confirm this request was not sent. Check wallet activity or enter its transaction hash.',
  PENDING_CHANGED: 'Withdrawal status changed in another tab. Reload before continuing.',
  SIGNATURE_PENDING:
    'Wallet approval is still open in another tab. Finish or close it there, then check again.',
  LOCK_UNAVAILABLE:
    'This browser does not support the cross-tab lock needed for safe withdrawals. Update your browser and try again.',
  default: 'The network could not complete the request. Check status before trying again.',
}
