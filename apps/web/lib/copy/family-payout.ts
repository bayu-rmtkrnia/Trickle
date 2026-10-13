import { isApiError } from '@/lib/api/errors'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import type { Locale } from '@/lib/i18n/config'

const id = {
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
  history: {
    open: 'Riwayat',
    title: 'Riwayat pencairan',
    loading: 'Memuat riwayat...',
    emptyTitle: 'Belum ada pencairan',
    emptyBody: 'Pencairan yang kamu kirim akan muncul di sini beserta statusnya.',
    loadError: 'Riwayat belum dapat dimuat',
    loadErrorBody: 'Periksa koneksi lalu coba lagi. Ini bukan berarti belum ada pencairan.',
    pageError: 'Riwayat berikutnya belum dapat dimuat',
    pollError:
      'Status terbaru belum dapat diperbarui. Status terakhir yang diketahui tetap ditampilkan.',
    retry: 'Coba lagi',
    more: 'Muat riwayat lainnya',
    loadingMore: 'Memuat riwayat...',
    back: 'Kembali ke riwayat',
    detailTitle: 'Detail pencairan',
    detail: (date: string) => `Detail pencairan ${date}`,
    idrPending: 'Rupiah menunggu server',
    statuses: {
      PENDING: 'Menunggu',
      PROCESSING: 'Diproses',
      COMPLETED: 'Selesai',
      FAILED: 'Gagal',
    } as Record<string, string>,
    failedHint:
      'Token sudah terkirim. Pencairan bank gagal dan token tidak dikembalikan otomatis; hubungi tim dengan hash transfer ini.',
    providerHint:
      'Provider uji mensimulasikan transfer bank. Waktu selesai mengikuti konfigurasi server.',
  },
}
export type PayoutCopy = typeof id

const en: PayoutCopy = {
  title: 'Cash out to bank',
  testMode: 'Test mode',
  testModeHint:
    'mAUSD is really sent on testnet. The bank transfer is simulated by a test provider, not a real bank transfer.',
  open: 'Cash out',
  status: 'View cash-out status',
  notConfigured: 'Cash-out isn’t set up',
  notConfiguredBody: 'The cash-out address isn’t set for this environment. Tokens can’t be sent.',
  noBank: 'Add a bank account first to cash out.',
  noBalance: 'Nothing available to cash out yet.',
  bank: 'Destination account',
  amount: 'mAUSD amount',
  amountHint: (max: string) => `Available balance: ${max}`,
  max: 'All',
  estimate: 'Estimated to receive',
  estimateHint:
    'Estimated from the current rate. The final rupiah amount is set by the server when the cash-out is processed.',
  rateUnavailable: 'Rate not available; the rupiah amount is set by the server.',
  confirm: 'Send and cash out',
  preparing: 'Checking balance, account and gas...',
  cancel: 'Cancel',
  close: 'Close',
  done: 'Done',
  explorer: 'View token transfer in explorer',
  hash: 'Token transfer hash',
  amountErrors: {
    empty: 'Enter an amount.',
    invalid: 'Use a number, for example 12.5.',
    precision: 'At most 6 decimal places.',
    zero: 'The amount must be more than 0.',
    balance: 'The amount is more than your balance.',
  },
  bankRequired: 'Choose a destination account.',
  phases: {
    idle: 'Cash out to bank',
    confirming: 'Confirm cash-out',
    signing: 'Waiting for wallet approval',
    'transfer-pending': 'Waiting for token transfer confirmation',
    'submission-unknown': 'Token transfer status unknown',
    'registration-pending': 'Tokens sent, cash-out not registered yet',
    processing: 'Cash-out in progress',
    completed: 'Cash-out complete',
    'transfer-failed': 'Token transfer failed',
    'payout-failed': 'Bank cash-out failed',
  },
  bodies: {
    signing: 'Approve the transfer in your Privy wallet. Don’t send another cash-out meanwhile.',
    'transfer-pending':
      'The token transfer was sent. You can close this panel; its status is still being checked.',
    'submission-unknown': 'Don’t send it again. Check the transfer you already submitted first.',
    'registration-pending':
      'The tokens reached the cash-out address. Register again with the same hash; no new transfer is made.',
    processing:
      'The test provider is processing the bank transfer. The status updates automatically.',
    completed: 'The test provider marked the bank transfer as complete.',
    'transfer-failed': 'The token transfer failed on the network. Nothing counts as sent.',
    'payout-failed':
      'The tokens were sent but the bank cash-out failed. Tokens aren’t returned automatically; the team needs to resolve it manually using this transfer hash.',
  },
  retryRegistration: 'Register cash-out again',
  registering: 'Registering cash-out...',
  check: 'Check transfer',
  checking: 'Checking transfer...',
  recoveryLabel: 'Transaction hash (optional)',
  recoveryHint: 'Paste the transfer hash from your wallet explorer if the status can’t be found.',
  recoveryExplorer: 'View wallet activity in explorer',
  verifyUnsent: 'Check the transfer wasn’t sent',
  unreadableTitle: 'Recovery data can’t be read',
  unreadableBody:
    'Your browser has a cash-out record that’s damaged or from another network, so the app can’t tell whether an earlier transfer was sent. Open your wallet activity in the explorer and make sure no mAUSD transfer is unrecorded.',
  unreadableHash: 'Hash still readable from the record',
  unreadableConfirm:
    'I’ve checked my wallet activity in the explorer. A transfer that was already sent still needs to be registered or reported to the team.',
  discard: 'Delete recovery data',
  verifyUnsentHint:
    'Only use this if you didn’t approve the transfer in your wallet. The app checks the network first.',
  changeBank: 'Use this account',
  changeBankTitle: 'Destination account not found',
  changeBankBody:
    'The tokens were already sent. Choose another account for the same transfer hash; no new transfer is made.',
  sentAmount: 'Tokens sent',
  receivedIdr: 'Received (from server)',
  rate: 'Rate used',
  provider: 'Provider',
  reference: 'Provider reference',
  account: 'Account',
  failureReason: 'Reason',
  errorTitle: 'Cash-out can’t continue',
  history: {
    open: 'History',
    title: 'Cash-out history',
    loading: 'Loading history...',
    emptyTitle: 'No cash-outs yet',
    emptyBody: 'Cash-outs you send will show up here with their status.',
    loadError: 'History couldn’t load',
    loadErrorBody: 'Check your connection and try again. This doesn’t mean there are no cash-outs.',
    pageError: 'Couldn’t load more history',
    pollError: 'The latest status couldn’t be updated. The last known status is still shown.',
    retry: 'Try again',
    more: 'Load more history',
    loadingMore: 'Loading history...',
    back: 'Back to history',
    detailTitle: 'Cash-out details',
    detail: (date: string) => `Cash-out details ${date}`,
    idrPending: 'Rupiah pending from server',
    statuses: {
      PENDING: 'Waiting',
      PROCESSING: 'Processing',
      COMPLETED: 'Complete',
      FAILED: 'Failed',
    } as Record<string, string>,
    failedHint:
      'The tokens were sent. The bank cash-out failed and tokens aren’t returned automatically; contact the team with this transfer hash.',
    providerHint:
      'The test provider simulates the bank transfer. Completion time follows the server setup.',
  },
}

export const payoutCopy: Record<Locale, PayoutCopy> = { id: id, en: en }

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
  SIGNATURE_PENDING:
    'Persetujuan wallet untuk pencairan ini masih terbuka di tab lain. Selesaikan atau tutup di sana, lalu periksa lagi.',
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

export function payoutMessage(error: unknown, locale: Locale = 'id'): string {
  if (locale === 'en') return payoutMessageEn(error)
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

const messagesEn: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Your token balance isn’t enough for this amount. Refresh your balance.',
  INVALID_REQUEST: 'The cash-out request isn’t valid.',
  DEPLOYMENT_MISMATCH: 'The network or token setup doesn’t match. No tokens were sent.',
  GAS_INSUFFICIENT: 'Not enough gas in your wallet. No tokens were sent.',
  GAS_FAILED: 'Gas funding didn’t work. No tokens were sent.',
  GAS_PENDING: 'Gas funding is still processing. Try again shortly.',
  DRIP_UNAVAILABLE: 'Gas funding isn’t set up yet. No tokens were sent.',
  DRIP_FAILED: 'Gas funding didn’t work. No tokens were sent.',
  DRIP_DAILY_LIMIT: 'Today’s gas funding limit was reached. Try again tomorrow.',
  WALLET_CHANGED: 'Your account or wallet changed. Reopen the cash-out from the right account.',
  WALLET_NOT_READY: 'Your wallet couldn’t switch networks. No tokens were sent.',
  NOT_RECIPIENT: 'This account isn’t connected as family yet. No tokens were sent.',
  REVERTED: 'The token transfer failed on the network.',
  REPLACED: 'The transfer was replaced or canceled in your wallet. This cash-out isn’t confirmed.',
  TRANSACTION_MISMATCH: 'That transaction doesn’t match this cash-out.',
  RECEIPT_UNVERIFIED: 'The transfer couldn’t be verified. Check it before sending again.',
  INVALID_HASH: 'Enter a valid transaction hash from the explorer.',
  STORAGE_UNAVAILABLE:
    'Cash-out recovery data in this browser can’t be read. Check your wallet activity in the explorer before sending again.',
  PENDING_MISMATCH:
    'There’s cash-out data from another network setup. New cash-outs are held so nothing is sent twice.',
  PENDING_CHANGED: 'The cash-out status changed in another tab. Reload before continuing.',
  SIGNATURE_PENDING:
    'A wallet approval for this cash-out is still open in another tab. Finish or close it there, then check again.',
  RECOVERY_UNVERIFIED:
    'We couldn’t confirm the transfer wasn’t sent. Check your wallet activity or enter its transaction hash.',
  PAYOUT_MISMATCH: 'The cash-out response doesn’t match this transfer. Try registering again.',
  TX_PENDING: 'The server hasn’t confirmed the transfer yet. Register again shortly.',
  CHAIN_UNAVAILABLE: 'The server can’t check the transfer yet. Register again shortly.',
  PAYOUTS_UNAVAILABLE:
    'Cash-out isn’t set up on the server yet. Your tokens are safe; register again once it’s ready.',
  TX_FAILED: 'The server says the transfer failed. Save the hash and contact the team.',
  TX_NOT_A_PAYOUT:
    'The server doesn’t recognize this transfer as a cash-out (different destination). Save the hash and contact the team.',
  PAYOUT_EXISTS:
    'This transfer was already used by another account. Save the hash and contact the team.',
  BANK_ACCOUNT_NOT_FOUND: 'Destination account not found. Choose another account.',
  UNAUTHORIZED: 'Your session ended. Refresh your session; the transfer won’t be resent.',
  RATE_LIMITED: 'Too many requests. Wait a moment.',
  INVALID_RESPONSE: 'The server response doesn’t look right. Try again.',
}

function payoutMessageEn(error: unknown): string {
  if (isRejected(error)) return 'Approval canceled. No tokens were sent.'
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && messagesEn[code]) return messagesEn[code]
  if (isApiError(error)) {
    if (error.status === 401) return messagesEn.UNAUTHORIZED!
    if (error.status === 404) return messagesEn.BANK_ACCOUNT_NOT_FOUND!
    if (error.status === 429) return messagesEn.RATE_LIMITED!
  }
  return 'The service or network couldn’t finish the request. Check the status before trying again.'
}
