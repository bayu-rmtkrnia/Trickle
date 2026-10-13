import { isApiError } from '@/lib/api/errors'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import type { Locale } from '@/lib/i18n/config'

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

export const payoutDictionary: Record<Locale, typeof payoutCopy> = {
  id: payoutCopy,
  en: {
    ...payoutCopy,
    title: 'Cash out to bank account',
    testMode: 'Test mode',
    testModeHint:
      'mAUSD tokens are actually sent on testnet. The bank transfer is simulated by a test provider; no real bank transfer occurs.',
    open: 'Cash out',
    status: 'View payout status',
    notConfigured: 'Payout is not configured',
    notConfiguredBody:
      'The payout destination address is not configured for this environment. Tokens cannot be sent.',
    noBank: 'Add a bank account before cashing out.',
    noBalance: 'No funds available to cash out yet.',
    bank: 'Destination account',
    amount: 'Amount of mAUSD',
    amountHint: (max) => `Available balance: ${max}`,
    max: 'All',
    estimate: 'Estimated amount received',
    estimateHint:
      'Estimate based on the current rate. The server determines the final rupiah amount when processing the payout.',
    rateUnavailable: 'Rate unavailable; the server will determine the rupiah amount.',
    confirm: 'Send and cash out',
    preparing: 'Checking balance, bank account, and gas…',
    cancel: 'Cancel',
    close: 'Close',
    done: 'Done',
    explorer: 'View token transfer in explorer',
    hash: 'Token transfer hash',
    amountErrors: {
      empty: 'Enter an amount.',
      invalid: 'Use a number, for example 12.5.',
      precision: 'Up to 6 decimal places.',
      zero: 'Amount must be greater than 0.',
      balance: 'Amount exceeds your balance.',
    },
    bankRequired: 'Choose a destination account.',
    phases: {
      idle: 'Cash out to bank account',
      confirming: 'Confirm payout',
      signing: 'Waiting for wallet approval',
      'transfer-pending': 'Waiting for token transfer confirmation',
      'submission-unknown': 'Token transfer status unknown',
      'registration-pending': 'Tokens sent; payout not registered',
      processing: 'Payout processing',
      completed: 'Payout completed',
      'transfer-failed': 'Token transfer failed',
      'payout-failed': 'Bank payout failed',
    },
    bodies: {
      signing:
        'Approve the transfer in your Privy wallet. Do not start another payout during this process.',
      'transfer-pending':
        'The token transfer was submitted. You may close this panel; its status will still be checked.',
      'submission-unknown': 'Do not send again. Check the submitted transfer first.',
      'registration-pending':
        'Tokens reached the payout address. Register again with the same hash; no new transfer is made.',
      processing:
        'The test provider is processing the bank transfer. Status updates automatically.',
      completed: 'The test provider marked the bank transfer completed.',
      'transfer-failed': 'The token transfer failed on-chain. The balance is not considered sent.',
      'payout-failed':
        'Tokens were sent but the bank payout failed. Tokens are not returned automatically; the team must resolve this manually using the transfer hash.',
    },
    retryRegistration: 'Register payout again',
    registering: 'Registering payout…',
    check: 'Check transfer',
    checking: 'Checking transfer…',
    recoveryLabel: 'Transaction hash (optional)',
    recoveryHint:
      'Paste the transfer hash from your wallet explorer if its status cannot be found.',
    recoveryExplorer: 'View wallet activity in explorer',
    verifyUnsent: 'Verify transfer was not sent',
    unreadableTitle: 'Recovery data cannot be read',
    unreadableBody:
      'The browser has a corrupted payout record or one from another network. The app cannot confirm whether an earlier transfer was sent. Check wallet activity in the explorer for unregistered mAUSD transfers.',
    unreadableHash: 'Hash still readable from the record',
    unreadableConfirm:
      'I have checked wallet activity in the explorer. Any sent transfer still needs to be registered or reported to the team.',
    discard: 'Clear recovery data',
    verifyUnsentHint:
      'Use only if you did not approve the transfer in your wallet. The app checks the network first.',
    changeBank: 'Use this account',
    changeBankTitle: 'Destination account not found',
    changeBankBody:
      'Tokens have already been sent. Choose another account for the same transfer hash; no new transfer is made.',
    sentAmount: 'Tokens sent',
    receivedIdr: 'Received (from server)',
    rate: 'Rate used',
    provider: 'Provider',
    reference: 'Provider reference',
    account: 'Account',
    failureReason: 'Reason',
    errorTitle: 'Payout cannot continue yet',
    history: {
      open: 'History',
      title: 'Payout history',
      loading: 'Loading history…',
      emptyTitle: 'No payouts yet',
      emptyBody: 'Submitted payouts and their statuses will appear here.',
      loadError: 'Could not load history',
      loadErrorBody:
        'Check your connection and try again. This does not mean there are no payouts.',
      pageError: 'Could not load more history',
      pollError: 'Could not refresh the latest status. The last known status remains visible.',
      retry: 'Try again',
      more: 'Load more history',
      loadingMore: 'Loading history…',
      back: 'Back to history',
      detailTitle: 'Payout details',
      detail: (date) => `Payout details ${date}`,
      idrPending: 'Rupiah amount pending server',
      statuses: {
        PENDING: 'Pending',
        PROCESSING: 'Processing',
        COMPLETED: 'Completed',
        FAILED: 'Failed',
      },
      failedHint:
        'Tokens were sent. The bank payout failed and tokens are not automatically returned; contact the team with this transfer hash.',
      providerHint:
        'The test provider simulates the bank transfer. Completion time depends on server configuration.',
    },
  },
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
  if (isRejected(error))
    return locale === 'en'
      ? 'Approval canceled. Tokens were not sent.'
      : 'Persetujuan dibatalkan. Token tidak dikirim.'
  const code = (error as { code?: unknown } | null)?.code
  const copy = locale === 'en' ? englishMessages : messages
  if (typeof code === 'string' && copy[code]) return copy[code]!
  if (isApiError(error)) {
    if (error.status === 401) return copy.UNAUTHORIZED!
    if (error.status === 404) return copy.BANK_ACCOUNT_NOT_FOUND!
    if (error.status === 429) return copy.RATE_LIMITED!
  }
  return locale === 'en'
    ? 'The service or network could not complete the request. Check the status before trying again.'
    : 'Layanan atau jaringan belum dapat menyelesaikan permintaan. Periksa status sebelum mencoba lagi.'
}

const englishMessages: Record<string, string> = {
  INSUFFICIENT_BALANCE: 'Insufficient token balance. Refresh your balance.',
  INVALID_REQUEST: 'Invalid payout request.',
  DEPLOYMENT_MISMATCH: 'Network or token configuration does not match. Tokens were not sent.',
  GAS_INSUFFICIENT: 'Insufficient wallet gas. Tokens were not sent.',
  GAS_FAILED: 'Gas funding failed. Tokens were not sent.',
  GAS_PENDING: 'Gas funding is processing. Try again shortly.',
  DRIP_UNAVAILABLE: 'Gas funding is not configured. Tokens were not sent.',
  DRIP_FAILED: 'Gas funding failed. Tokens were not sent.',
  DRIP_DAILY_LIMIT: 'Daily gas funding limit reached. Try again tomorrow.',
  WALLET_CHANGED: 'Account or wallet changed. Open payout again from the correct account.',
  WALLET_NOT_READY: 'Wallet could not switch to the network. Tokens were not sent.',
  NOT_RECIPIENT: 'This account is not connected as family. Tokens were not sent.',
  REVERTED: 'Token transfer failed on-chain.',
  REPLACED: 'Transfer was replaced or canceled in the wallet. This payout is not confirmed.',
  TRANSACTION_MISMATCH: 'This transaction does not match the payout.',
  RECEIPT_UNVERIFIED: 'Transfer could not be verified. Check before sending again.',
  INVALID_HASH: 'Enter a valid transaction hash from the explorer.',
  STORAGE_UNAVAILABLE:
    'Browser recovery data cannot be read. Check wallet activity before sending again.',
  PENDING_MISMATCH:
    'Payout data belongs to another network configuration. New payouts are blocked to prevent duplicates.',
  PENDING_CHANGED: 'Payout status changed in another tab. Reload before continuing.',
  SIGNATURE_PENDING:
    'Wallet approval is open in another tab. Finish or close it there, then check again.',
  RECOVERY_UNVERIFIED:
    'Cannot confirm the transfer was not sent. Check wallet activity or enter its transaction hash.',
  PAYOUT_MISMATCH: 'Payout response does not match the transfer. Register again.',
  TX_PENDING: 'The server has not confirmed the transfer. Register again shortly.',
  CHAIN_UNAVAILABLE: 'The server cannot check the transfer yet. Register again shortly.',
  PAYOUTS_UNAVAILABLE:
    'Payout is not configured on the server. Tokens are safe; register again when service is available.',
  TX_FAILED: 'The server reports the transfer failed. Save the hash and contact the team.',
  TX_NOT_A_PAYOUT:
    'The server does not recognize this transfer as a payout (different destination). Save the hash and contact the team.',
  PAYOUT_EXISTS: 'This transfer was used by another account. Save the hash and contact the team.',
  BANK_ACCOUNT_NOT_FOUND: 'Destination account not found. Choose another account.',
  UNAUTHORIZED: 'Session expired. Refresh your session; the transfer will not be resent.',
  RATE_LIMITED: 'Too many requests. Wait a moment.',
  INVALID_RESPONSE: 'Unexpected server response. Try again.',
}
