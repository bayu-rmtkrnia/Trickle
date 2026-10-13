import { ChainReadError } from '@/lib/chain/types'
import type { Locale } from '@/lib/i18n/config'

export const payrollCopy = {
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
export const payrollDictionary: Record<Locale, typeof payrollCopy> = {
  id: payrollCopy,
  en: {
    loading: 'Finding payroll on the network…',
    loadingBody: 'Your balance appears after all wallet payroll data has been read.',
    unavailable: 'Balance unavailable',
    demo: 'Demo asset',
    demoHint: 'Testnet token for testing only. It has no real monetary value.',
    details: 'Details',
    detailsTitle: 'Fund details',
    viewPayroll: 'View payroll',
    payrollCount: (count) => `${count} payroll streams`,
    payrollPending: 'Not loaded yet',
    estimate: 'Estimate from the latest block',
    stale: 'Payroll data is delayed',
    staleHint:
      'Showing the last successfully read block. The estimate pauses until data refreshes.',
    empty: 'No payroll for this wallet yet',
    emptyHint:
      'Your employer needs to fund payroll for your wallet before salary starts streaming.',
    walletBalance: 'Token balance in wallet',
    workerShare: 'Estimated share for you',
    familyShare: 'Estimated share for family',
    recipientShare: (index, address, percent) =>
      `Recipient ${index} (${address.slice(0, 6)}…${address.slice(-4)}, ${percent}%)`,
    noSplit: 'Family sharing is not set up yet.',
    splitHint: 'Shares are sent when you withdraw. Final amounts follow the confirmed transaction.',
    streams: 'Your payroll',
    stream: (id) => `Stream #${id}`,
    unknownSender: 'Sender not recognized yet',
    sender: 'View sender in explorer',
    period: 'Payroll period',
    available: 'Available',
    retry: 'Refresh payroll',
    refreshing: 'Refreshing payroll…',
    withdrawStream: 'Withdraw stream',
    statuses: {
      scheduled: 'Not started',
      active: 'Active',
      ended: 'Ended, still withdrawable',
      canceled: 'Canceled',
      depleted: 'Fully withdrawn',
    },
    errors: {
      read: {
        title: 'Could not read payroll',
        message: 'The network is unavailable. Try refreshing payroll.',
      },
      configuration: {
        title: 'Payroll configuration does not match',
        message: 'The wallet or network configuration cannot read this payroll.',
      },
      scan: {
        title: 'Payroll search is incomplete',
        message:
          'Refresh payroll to continue the search. The balance is hidden until all data is available.',
      },
      consistency: {
        title: 'Payroll must be read again',
        message: 'Network data changed while loading. Refresh for a consistent result.',
      },
    },
  },
}
export function payrollError(error: unknown, phase?: string, locale: Locale = 'id') {
  const copy = payrollDictionary[locale]
  if (phase === 'unconfigured') return copy.errors.configuration
  if (error instanceof ChainReadError) {
    if (['DEPLOYMENT_MISMATCH', 'INVALID_WALLET'].includes(error.code))
      return copy.errors.configuration
    if (error.code === 'SCAN_INCOMPLETE') return copy.errors.scan
    if (['CHAIN_CHANGED', 'SNAPSHOT_MISMATCH', 'STREAM_OWNERSHIP'].includes(error.code))
      return copy.errors.consistency
  }
  return copy.errors.read
}
