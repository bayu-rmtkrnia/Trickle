import { isApiError } from '@/lib/api/errors'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import type { Locale } from '@/lib/i18n/config'

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

const id = {
  title: 'Keluarga',
  body: 'Penerima pembagian gaji dan undangan keluarga.',
  loading: 'Memuat keluarga...',
  loadError: 'Data keluarga belum dapat dimuat',
  loadErrorBody: 'Periksa koneksi lalu coba lagi.',
  retry: 'Coba lagi',
  splitTitle: 'Pembagian gaji',
  splitOff: 'Pembagian ke keluarga tidak aktif. Seluruh penarikan masuk ke wallet kamu.',
  splitUnknown: 'Pembagian aktif belum dapat dibaca dari jaringan.',
  splitWorker: (percent: string) => `Kamu menerima ${percent}%`,
  editSplit: 'Atur pembagian',
  recipientsTitle: 'Penerima',
  recipientsEmpty: 'Belum ada penerima. Undang anggota keluarga terlebih dahulu.',
  unnamed: (address: string) => `Penerima ${short(address)}`,
  share: (percent: string) => `${percent}% dari penarikan`,
  noShare: 'Tidak menerima pembagian',
  remove: 'Hapus',
  removeLabel: (name: string) => `Hapus penerima ${name}`,
  invitesTitle: 'Undangan keluarga',
  invitesEmpty: 'Belum ada undangan.',
  invite: 'Undang keluarga',
  copyLink: 'Salin link',
  copied: 'Link disalin',
  cancelInvite: 'Batalkan',
  cancelLabel: (name: string) => `Batalkan undangan ${name}`,
  inviteStatus: {
    PENDING: 'Menunggu',
    ACCEPTED: 'Diterima',
    REVOKED: 'Dibatalkan',
    EXPIRED: 'Kedaluwarsa',
  } as Record<string, string>,
  inviteSheet: {
    title: 'Undang keluarga',
    description: 'Bagikan link agar anggota keluarga membuat akun dan menerima undangan.',
    name: 'Nama',
    relation: 'Hubungan (opsional)',
    relationHint: 'Contoh: Ibu, Istri',
    submit: 'Buat link undangan',
    submitting: 'Membuat link...',
    successTitle: 'Link undangan dibuat',
    successBody: (name: string) => `Kirim link ini ke ${name}.`,
    another: 'Undang yang lain',
    nameRequired: 'Isi nama 1–100 karakter.',
    relationInvalid: 'Hubungan maksimal 40 karakter.',
  },
  splitSheet: {
    title: 'Atur pembagian',
    description:
      'Maksimal 3 penerima. Bagian dihitung dari setiap penarikan dan dikirim langsung ke wallet mereka.',
    recipient: (index: number) => `Penerima ${index}`,
    choose: 'Pilih penerima',
    percent: 'Persen',
    percentHint: 'Maksimal 2 angka di belakang koma.',
    add: 'Tambah penerima',
    removeRow: 'Hapus baris',
    total: (percent: string) => `Total ke keluarga: ${percent}%`,
    worker: (percent: string) => `Kamu menerima: ${percent}%`,
    save: 'Simpan pembagian',
    turnOff: 'Matikan pembagian',
    preparing: 'Memeriksa wallet dan gas...',
    noRecipients: 'Tambahkan penerima lewat undangan keluarga terlebih dahulu.',
    close: 'Tutup',
    recheck: 'Periksa status transaksi',
    reset: 'Coba lagi',
    explorer: 'Lihat transaksi di explorer',
    phases: {
      preparing: 'Menyiapkan transaksi',
      signing: 'Menunggu persetujuan wallet',
      pending: 'Menunggu konfirmasi jaringan',
      success: 'Pembagian tersimpan',
      failed: 'Pembagian belum tersimpan',
      unknown: 'Status transaksi belum diketahui',
    } as Record<string, string>,
    unknownBody:
      'Periksa status transaksi terlebih dahulu. Mengirim ulang pembagian yang sama tidak mengubah hasilnya, tetapi memakai gas lagi.',
    errors: {
      recipient: 'Pilih penerima.',
      percent: 'Masukkan persen 0,01–100.',
      TOO_MANY_RECIPIENTS: 'Maksimal 3 penerima.',
      DUPLICATE_RECIPIENT: 'Penerima ini sudah dipilih.',
      INVALID_BPS: 'Persen harus lebih dari 0 dan paling banyak 100.',
      TOTAL_OVER_100: 'Total pembagian melebihi 100%.',
      INVALID_ADDRESS: 'Alamat penerima tidak valid.',
      ZERO_ADDRESS: 'Alamat penerima tidak valid.',
    } as Record<string, string>,
  },
  removeSheet: {
    title: 'Hapus penerima?',
    body: (name: string) =>
      `${name} tidak lagi tampil sebagai penerima. Pembagian di jaringan tidak berubah oleh penghapusan ini.`,
    confirm: 'Hapus penerima',
    confirming: 'Menghapus...',
    cancel: 'Batal',
    splitActiveTitle: 'Penerima masih menerima pembagian',
    splitActiveBody:
      'Ubah pembagian tanpa penerima ini (atau matikan pembagian) terlebih dahulu, lalu hapus lagi.',
    openSplit: 'Atur pembagian',
  },
}
export type WorkerFamilyCopy = typeof id

const en: WorkerFamilyCopy = {
  title: 'Family',
  body: 'Who receives part of your pay, and your family invites.',
  loading: 'Loading family...',
  loadError: 'Family details couldn’t load',
  loadErrorBody: 'Check your connection and try again.',
  retry: 'Try again',
  splitTitle: 'Pay split',
  splitOff: 'Family split is off. Every withdrawal goes to your wallet.',
  splitUnknown: 'The active split couldn’t be read from the network.',
  splitWorker: (percent: string) => `You receive ${percent}%`,
  editSplit: 'Set up split',
  recipientsTitle: 'Recipients',
  recipientsEmpty: 'No recipients yet. Invite a family member first.',
  unnamed: (address: string) => `Recipient ${short(address)}`,
  share: (percent: string) => `${percent}% of each withdrawal`,
  noShare: 'Not receiving a share',
  remove: 'Remove',
  removeLabel: (name: string) => `Remove recipient ${name}`,
  invitesTitle: 'Family invites',
  invitesEmpty: 'No invites yet.',
  invite: 'Invite family',
  copyLink: 'Copy link',
  copied: 'Link copied',
  cancelInvite: 'Cancel',
  cancelLabel: (name: string) => `Cancel invite for ${name}`,
  inviteStatus: {
    PENDING: 'Waiting',
    ACCEPTED: 'Accepted',
    REVOKED: 'Canceled',
    EXPIRED: 'Expired',
  } as Record<string, string>,
  inviteSheet: {
    title: 'Invite family',
    description:
      'Share the link so your family member can create an account and accept the invite.',
    name: 'Name',
    relation: 'Relationship (optional)',
    relationHint: 'For example: Mother, Wife',
    submit: 'Create invite link',
    submitting: 'Creating link...',
    successTitle: 'Invite link created',
    successBody: (name: string) => `Send this link to ${name}.`,
    another: 'Invite someone else',
    nameRequired: 'Enter a name of 1–100 characters.',
    relationInvalid: 'Relationship can be at most 40 characters.',
  },
  splitSheet: {
    title: 'Set up split',
    description:
      'Up to 3 recipients. Their share is taken from every withdrawal and sent straight to their wallet.',
    recipient: (index: number) => `Recipient ${index}`,
    choose: 'Choose recipient',
    percent: 'Percent',
    percentHint: 'At most 2 decimal places.',
    add: 'Add recipient',
    removeRow: 'Remove row',
    total: (percent: string) => `Total to family: ${percent}%`,
    worker: (percent: string) => `You receive: ${percent}%`,
    save: 'Save split',
    turnOff: 'Turn off split',
    preparing: 'Checking wallet and gas...',
    noRecipients: 'Add recipients through a family invite first.',
    close: 'Close',
    recheck: 'Check transaction status',
    reset: 'Try again',
    explorer: 'View transaction in explorer',
    phases: {
      preparing: 'Preparing transaction',
      signing: 'Waiting for wallet approval',
      pending: 'Waiting for network confirmation',
      success: 'Split saved',
      failed: 'Split wasn’t saved',
      unknown: 'Transaction status unknown',
    } as Record<string, string>,
    unknownBody:
      'Check the transaction status first. Sending the same split again doesn’t change the result, but it uses gas again.',
    errors: {
      recipient: 'Choose a recipient.',
      percent: 'Enter a percent from 0.01 to 100.',
      TOO_MANY_RECIPIENTS: 'Up to 3 recipients.',
      DUPLICATE_RECIPIENT: 'This recipient is already chosen.',
      INVALID_BPS: 'Percent must be more than 0 and at most 100.',
      TOTAL_OVER_100: 'The total split is over 100%.',
      INVALID_ADDRESS: 'The recipient address isn’t valid.',
      ZERO_ADDRESS: 'The recipient address isn’t valid.',
    } as Record<string, string>,
  },
  removeSheet: {
    title: 'Remove recipient?',
    body: (name: string) =>
      `${name} will no longer show as a recipient. Removing them doesn’t change the split on the network.`,
    confirm: 'Remove recipient',
    confirming: 'Removing...',
    cancel: 'Cancel',
    splitActiveTitle: 'This recipient still receives a share',
    splitActiveBody:
      'Change the split without this recipient (or turn the split off) first, then remove them again.',
    openSplit: 'Set up split',
  },
}

export const workerFamilyCopy: Record<Locale, WorkerFamilyCopy> = { id: id, en: en }

export function familyApiMessage(
  error: unknown,
  locale: Locale = 'id',
): { title: string; message: string } {
  const code = isApiError(error) ? error.code : null
  const status = isApiError(error) ? error.status : null
  if (code === 'SPLIT_ACTIVE')
    return {
      title: workerFamilyCopy[locale].removeSheet.splitActiveTitle,
      message: workerFamilyCopy[locale].removeSheet.splitActiveBody,
    }
  if (locale === 'en') return familyApiMessageEn(code, status)
  if (code === 'INVITE_ALREADY_ACCEPTED')
    return {
      title: 'Undangan sudah diterima',
      message: 'Undangan ini tidak dapat dibatalkan lagi.',
    }
  if (status === 401)
    return { title: 'Sesi perlu diperbarui', message: 'Perbarui sesi, lalu coba lagi.' }
  if (status === 403)
    return { title: 'Akun belum dapat mengelola keluarga', message: 'Masuk dengan akun worker.' }
  if (status === 404) return { title: 'Data tidak ditemukan', message: 'Muat ulang data keluarga.' }
  if (status === 422 || status === 400)
    return { title: 'Data belum sesuai', message: 'Periksa kembali isian kamu.' }
  if (status === 429)
    return { title: 'Terlalu banyak permintaan', message: 'Tunggu sebentar sebelum mencoba lagi.' }
  return { title: 'Permintaan belum berhasil', message: 'Coba lagi dalam beberapa saat.' }
}

export function splitTxMessage(error: unknown, locale: Locale = 'id'): string {
  if (locale === 'en') return splitTxMessageEn(error)
  if (isRejected(error)) return 'Persetujuan dibatalkan. Pembagian tidak diubah.'
  const code = error instanceof WithdrawalError ? error.code : null
  const messages: Record<string, string> = {
    INVALID_SPLIT: 'Daftar pembagian tidak valid.',
    DEPLOYMENT_MISMATCH: 'Konfigurasi jaringan payroll belum sesuai.',
    GAS_INSUFFICIENT: 'Gas wallet belum cukup. Transaksi belum dikirim.',
    GAS_FAILED: 'Pendanaan gas belum berhasil. Transaksi belum dikirim.',
    GAS_PENDING: 'Pendanaan gas masih diproses. Coba lagi sebentar lagi.',
    WALLET_CHANGED: 'Akun atau wallet berubah. Buka kembali dari akun yang sesuai.',
    WALLET_NOT_READY: 'Wallet belum dapat beralih ke jaringan payroll.',
    REVERTED: 'Transaksi gagal di jaringan. Pembagian tidak berubah.',
    REPLACED: 'Transaksi diganti atau dibatalkan di wallet.',
    TRANSACTION_MISMATCH: 'Transaksi tidak cocok dengan pembagian ini.',
    RECEIPT_UNVERIFIED: 'Hasil transaksi belum dapat diverifikasi.',
  }
  if (code && messages[code]) return messages[code]!
  return 'Jaringan belum dapat menyelesaikan permintaan. Periksa status sebelum mencoba lagi.'
}

function familyApiMessageEn(code: string | null | undefined, status: number | null | undefined) {
  if (code === 'INVITE_ALREADY_ACCEPTED')
    return { title: 'Invite already accepted', message: 'This invite can’t be canceled anymore.' }
  if (status === 401)
    return {
      title: 'Your session needs a refresh',
      message: 'Refresh your session, then try again.',
    }
  if (status === 403)
    return { title: 'This account can’t manage family', message: 'Sign in with a worker account.' }
  if (status === 404) return { title: 'Not found', message: 'Reload your family details.' }
  if (status === 422 || status === 400)
    return { title: 'Details don’t look right', message: 'Check what you entered.' }
  if (status === 429)
    return { title: 'Too many requests', message: 'Wait a moment before trying again.' }
  return { title: 'Request didn’t go through', message: 'Try again in a moment.' }
}

function splitTxMessageEn(error: unknown): string {
  if (isRejected(error)) return 'Approval canceled. The split wasn’t changed.'
  const code = error instanceof WithdrawalError ? error.code : null
  const messages: Record<string, string> = {
    INVALID_SPLIT: 'The split list isn’t valid.',
    DEPLOYMENT_MISMATCH: 'The payroll network setup doesn’t match.',
    GAS_INSUFFICIENT: 'Not enough gas in your wallet. The transaction wasn’t sent.',
    GAS_FAILED: 'Gas funding didn’t work. The transaction wasn’t sent.',
    GAS_PENDING: 'Gas funding is still processing. Try again shortly.',
    WALLET_CHANGED: 'Your account or wallet changed. Reopen this from the right account.',
    WALLET_NOT_READY: 'Your wallet couldn’t switch to the payroll network.',
    REVERTED: 'The transaction failed on the network. The split didn’t change.',
    REPLACED: 'The transaction was replaced or canceled in your wallet.',
    TRANSACTION_MISMATCH: 'The transaction doesn’t match this split.',
    RECEIPT_UNVERIFIED: 'The transaction result couldn’t be verified.',
  }
  if (code && messages[code]) return messages[code]!
  return 'The network couldn’t finish the request. Check the status before trying again.'
}
