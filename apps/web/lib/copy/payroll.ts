import { ChainReadError } from '@/lib/chain/types'
import type { Locale } from '@/lib/i18n/config'

const id = {
  loading: 'Mencari payroll di jaringan...',
  loadingBody: 'Saldo ditampilkan setelah seluruh data payroll wallet berhasil dibaca.',
  unavailable: 'Saldo belum tersedia',
  demo: 'Aset demo',
  demoHint: 'Token testnet untuk pengujian, tanpa nilai uang nyata.',
  details: 'Info detail',
  detailsTitle: 'Rincian dana',
  viewPayroll: 'Lihat payroll',
  payrollCount: (count: number) => `${count} payroll`,
  payrollPending: 'Belum dimuat',
  estimate: 'Estimasi dari block terakhir',
  stale: 'Data payroll tertunda',
  staleHint:
    'Menampilkan saldo pada block terakhir yang berhasil dibaca. Angka berhenti bergerak sampai data diperbarui.',
  empty: 'Belum ada payroll untuk wallet ini',
  emptyHint: 'Perusahaan perlu mendanai payroll ke wallet kamu sebelum gaji dapat mengalir.',
  walletBalance: 'Saldo token di wallet',
  workerShare: 'Perkiraan bagian kamu',
  familyShare: 'Perkiraan bagian keluarga',
  recipientShare: (index: number, address: string, percent: string) =>
    `Penerima ${index} (${address.slice(0, 6)}…${address.slice(-4)}, ${percent}%)`,
  noSplit: 'Belum ada pembagian ke keluarga.',
  splitHint:
    'Pembagian terjadi saat penarikan. Nilai akhirnya mengikuti transaksi yang dikonfirmasi.',
  streams: 'Payroll kamu',
  stream: (id: string) => `Stream #${id}`,
  unknownSender: 'Pengirim belum dikenali',
  sender: 'Lihat pengirim di explorer',
  period: 'Periode payroll',
  available: 'Tersedia',
  retry: 'Perbarui payroll',
  refreshing: 'Memperbarui payroll...',
  withdrawStream: 'Tarik stream',
  statuses: {
    scheduled: 'Belum mulai',
    active: 'Aktif',
    ended: 'Berakhir, masih dapat ditarik',
    canceled: 'Dibatalkan',
    depleted: 'Saldo sudah ditarik',
  },
  errors: {
    read: {
      title: 'Belum dapat membaca payroll',
      message: 'Jaringan belum dapat dihubungi. Coba perbarui payroll.',
    },
    configuration: {
      title: 'Konfigurasi payroll belum sesuai',
      message: 'Wallet atau konfigurasi jaringan belum dapat digunakan untuk membaca payroll.',
    },
    scan: {
      title: 'Pencarian payroll belum selesai',
      message:
        'Perbarui payroll untuk melanjutkan pencarian. Saldo belum ditampilkan karena data belum lengkap.',
    },
    consistency: {
      title: 'Data payroll perlu dibaca ulang',
      message:
        'Data jaringan berubah saat dimuat. Perbarui payroll untuk mendapatkan data yang konsisten.',
    },
  },
}
export type PayrollCopy = typeof id

const en: PayrollCopy = {
  loading: 'Looking for your payroll on the network...',
  loadingBody: 'Your balance appears once all payroll data for your wallet has been read.',
  unavailable: 'Balance not available yet',
  demo: 'Demo asset',
  demoHint: 'Testnet token for testing, with no real money value.',
  details: 'Details',
  detailsTitle: 'Fund details',
  viewPayroll: 'View payroll',
  payrollCount: (count: number) => `${count} payroll${count === 1 ? '' : 's'}`,
  payrollPending: 'Not loaded yet',
  estimate: 'Estimate from the latest block',
  stale: 'Payroll data is delayed',
  staleHint:
    'Showing the balance from the last block that was read. The number stops moving until the data is refreshed.',
  empty: 'No payroll for this wallet yet',
  emptyHint: 'Your company needs to fund payroll to your wallet before pay can flow.',
  walletBalance: 'Token balance in wallet',
  workerShare: 'Your estimated share',
  familyShare: 'Family’s estimated share',
  recipientShare: (index: number, address: string, percent: string) =>
    `Recipient ${index} (${address.slice(0, 6)}…${address.slice(-4)}, ${percent}%)`,
  noSplit: 'No family split yet.',
  splitHint:
    'The split happens when you withdraw. The final amount follows the confirmed transaction.',
  streams: 'Your payroll',
  stream: (id: string) => `Stream #${id}`,
  unknownSender: 'Unknown sender',
  sender: 'View sender in explorer',
  period: 'Pay period',
  available: 'Available',
  retry: 'Refresh payroll',
  refreshing: 'Refreshing payroll...',
  withdrawStream: 'Withdraw stream',
  statuses: {
    scheduled: 'Not started',
    active: 'Active',
    ended: 'Ended, still withdrawable',
    canceled: 'Canceled',
    depleted: 'Already withdrawn',
  },
  errors: {
    read: {
      title: 'Couldn’t read payroll',
      message: 'The network can’t be reached. Try refreshing payroll.',
    },
    configuration: {
      title: 'Payroll setup doesn’t match',
      message: 'The wallet or network setup can’t be used to read payroll.',
    },
    scan: {
      title: 'Payroll search not finished',
      message:
        'Refresh payroll to continue the search. The balance isn’t shown because the data is incomplete.',
    },
    consistency: {
      title: 'Payroll data needs a re-read',
      message: 'Network data changed while loading. Refresh payroll to get consistent data.',
    },
  },
}

export const payrollCopy: Record<Locale, PayrollCopy> = { id: id, en: en }
export function payrollError(error: unknown, phase?: string, locale: Locale = 'id') {
  const errors = payrollCopy[locale].errors
  if (phase === 'unconfigured') return errors.configuration
  if (error instanceof ChainReadError) {
    if (['DEPLOYMENT_MISMATCH', 'INVALID_WALLET'].includes(error.code)) return errors.configuration
    if (error.code === 'SCAN_INCOMPLETE') return errors.scan
    if (['CHAIN_CHANGED', 'SNAPSHOT_MISMATCH', 'STREAM_OWNERSHIP'].includes(error.code))
      return errors.consistency
  }
  return errors.read
}
