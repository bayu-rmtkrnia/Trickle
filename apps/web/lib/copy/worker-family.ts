import { isApiError } from '@/lib/api/errors'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { isRejected } from '@/lib/chain/withdrawal-coordinator'

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

export function familyApiMessage(error: unknown): { title: string; message: string } {
  const code = isApiError(error) ? error.code : null
  const status = isApiError(error) ? error.status : null
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

export function splitTxMessage(error: unknown): string {
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
