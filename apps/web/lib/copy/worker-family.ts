import { isApiError } from '@/lib/api/errors'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'
import type { Locale } from '@/lib/i18n/config'

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

export const workerFamilyCopy = {
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

export const workerFamilyDictionary: Record<Locale, typeof workerFamilyCopy> = {
  id: workerFamilyCopy,
  en: {
    title: 'Family',
    body: 'Salary sharing recipients and family invitations.',
    loading: 'Loading family…',
    loadError: 'Could not load family data',
    loadErrorBody: 'Check your connection and try again.',
    retry: 'Try again',
    splitTitle: 'Salary split',
    splitOff: 'Family sharing is off. All withdrawals go to your wallet.',
    splitUnknown: 'The active split could not be read from the network.',
    splitWorker: (percent) => `You receive ${percent}%`,
    editSplit: 'Set up split',
    recipientsTitle: 'Recipients',
    recipientsEmpty: 'No recipients yet. Invite a family member first.',
    unnamed: (address) => `Recipient ${short(address)}`,
    share: (percent) => `${percent}% of each withdrawal`,
    noShare: 'Not receiving a share',
    remove: 'Remove',
    removeLabel: (name) => `Remove recipient ${name}`,
    invitesTitle: 'Family invitations',
    invitesEmpty: 'No invitations yet.',
    invite: 'Invite family',
    copyLink: 'Copy link',
    copied: 'Link copied',
    cancelInvite: 'Cancel',
    cancelLabel: (name) => `Cancel invitation for ${name}`,
    inviteStatus: {
      PENDING: 'Pending',
      ACCEPTED: 'Accepted',
      REVOKED: 'Canceled',
      EXPIRED: 'Expired',
    },
    inviteSheet: {
      title: 'Invite family',
      description:
        'Share this link so your family member can create an account and accept the invitation.',
      name: 'Name',
      relation: 'Relationship (optional)',
      relationHint: 'For example: Mother, Spouse',
      submit: 'Create invitation link',
      submitting: 'Creating link…',
      successTitle: 'Invitation link created',
      successBody: (name) => `Send this link to ${name}.`,
      another: 'Invite someone else',
      nameRequired: 'Enter a name of 1–100 characters.',
      relationInvalid: 'Relationship must be at most 40 characters.',
    },
    splitSheet: {
      title: 'Set up split',
      description:
        'Up to 3 recipients. Shares are calculated on each withdrawal and sent directly to their wallets.',
      recipient: (index) => `Recipient ${index}`,
      choose: 'Choose a recipient',
      percent: 'Percent',
      percentHint: 'Up to 2 decimal places.',
      add: 'Add recipient',
      removeRow: 'Remove row',
      total: (percent) => `Total to family: ${percent}%`,
      worker: (percent) => `You receive: ${percent}%`,
      save: 'Save split',
      turnOff: 'Turn off split',
      preparing: 'Checking wallet and gas…',
      noRecipients: 'Add a recipient through a family invitation first.',
      close: 'Close',
      recheck: 'Check transaction status',
      reset: 'Try again',
      explorer: 'View transaction in explorer',
      phases: {
        preparing: 'Preparing transaction',
        signing: 'Waiting for wallet approval',
        pending: 'Waiting for network confirmation',
        success: 'Split saved',
        failed: 'Split not saved',
        unknown: 'Transaction status unknown',
      },
      unknownBody:
        'Check the transaction status first. Sending the same split again uses gas even if it does not change the result.',
      errors: {
        recipient: 'Choose a recipient.',
        percent: 'Enter a percentage from 0.01 to 100.',
        TOO_MANY_RECIPIENTS: 'Up to 3 recipients.',
        DUPLICATE_RECIPIENT: 'This recipient is already selected.',
        INVALID_BPS: 'Percentage must be above 0 and at most 100.',
        TOTAL_OVER_100: 'The total split exceeds 100%.',
        INVALID_ADDRESS: 'Invalid recipient address.',
        ZERO_ADDRESS: 'Invalid recipient address.',
      },
    },
    removeSheet: {
      title: 'Remove recipient?',
      body: (name) =>
        `${name} will no longer appear as a recipient. This does not change the on-chain split.`,
      confirm: 'Remove recipient',
      confirming: 'Removing…',
      cancel: 'Cancel',
      splitActiveTitle: 'Recipient still has an active share',
      splitActiveBody: 'Update the split without this recipient or turn it off, then remove them.',
      openSplit: 'Set up split',
    },
  },
}

export function familyApiMessage(
  error: unknown,
  locale: Locale = 'id',
): { title: string; message: string } {
  const code = isApiError(error) ? error.code : null
  const status = isApiError(error) ? error.status : null
  if (locale === 'en') {
    if (code === 'SPLIT_ACTIVE')
      return {
        title: workerFamilyDictionary.en.removeSheet.splitActiveTitle,
        message: workerFamilyDictionary.en.removeSheet.splitActiveBody,
      }
    if (code === 'INVITE_ALREADY_ACCEPTED')
      return { title: 'Invitation already accepted', message: 'This invitation cannot be revoked.' }
    if (status === 401)
      return { title: 'Session needs refreshing', message: 'Refresh your session and try again.' }
    if (status === 403) return { title: 'Cannot manage family', message: 'Sign in as a worker.' }
    if (status === 404) return { title: 'Data not found', message: 'Reload the family data.' }
    if (status === 422 || status === 400)
      return { title: 'Invalid details', message: 'Check the information you entered.' }
    if (status === 429)
      return { title: 'Too many requests', message: 'Wait a moment before trying again.' }
    return { title: 'Request unsuccessful', message: 'Try again in a moment.' }
  }
  if (code === 'SPLIT_ACTIVE')
    return {
      title: workerFamilyCopy.removeSheet.splitActiveTitle,
      message: workerFamilyCopy.removeSheet.splitActiveBody,
    }
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
  if (isRejected(error))
    return locale === 'en'
      ? 'Approval canceled. The split was not changed.'
      : 'Persetujuan dibatalkan. Pembagian tidak diubah.'
  const code = error instanceof WithdrawalError ? error.code : null
  if (locale === 'en') {
    const english: Record<string, string> = {
      INVALID_SPLIT: 'Invalid split settings.',
      DEPLOYMENT_MISMATCH: 'Payroll network configuration does not match.',
      GAS_INSUFFICIENT: 'Insufficient wallet gas. Transaction was not sent.',
      GAS_FAILED: 'Gas funding failed. Transaction was not sent.',
      GAS_PENDING: 'Gas funding is processing. Try again shortly.',
      WALLET_CHANGED:
        'Account or wallet changed. Open split settings again from the correct account.',
      WALLET_NOT_READY: 'Wallet could not switch to the payroll network.',
      REVERTED: 'Transaction failed on-chain. The split was not changed.',
      REPLACED: 'Transaction was replaced or canceled in the wallet.',
      TRANSACTION_MISMATCH: 'Transaction does not match this split.',
      RECEIPT_UNVERIFIED: 'Transaction result could not be verified.',
    }
    return (
      (code && english[code]) ||
      'The network could not complete the request. Check status before trying again.'
    )
  }
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
