import { ChainReadError } from '@/lib/chain/types'

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
export function payrollError(error: unknown, phase?: string) {
  if (phase === 'unconfigured') return payrollCopy.errors.configuration
  if (error instanceof ChainReadError) {
    if (['DEPLOYMENT_MISMATCH', 'INVALID_WALLET'].includes(error.code))
      return payrollCopy.errors.configuration
    if (error.code === 'SCAN_INCOMPLETE') return payrollCopy.errors.scan
    if (['CHAIN_CHANGED', 'SNAPSHOT_MISMATCH', 'STREAM_OWNERSHIP'].includes(error.code))
      return payrollCopy.errors.consistency
  }
  return payrollCopy.errors.read
}
