// Semua teks UI employer di satu tempat (DESIGN.md 8). Bahasa Indonesia, tanpa istilah crypto.

import { formatUsd } from '@/lib/format'

export const COUNTRIES = [
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapura' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'SA', name: 'Arab Saudi' },
  { code: 'JP', name: 'Jepang' },
  { code: 'KR', name: 'Korea Selatan' },
] as const

export const setupCopy = {
  step: 'Langkah 1 dari 1',
  title: 'Siapa perusahaanmu?',
  intro: 'Nama ini dilihat pekerja saat menerima undanganmu.',
  nameLabel: 'Nama perusahaan',
  namePlaceholder: 'Mis. PT. Maju Bersama',
  nameRequired: 'Isi nama perusahaan.',
  nameTooShort: 'Nama perusahaan minimal 2 huruf.',
  countryLabel: 'Negara',
  submit: 'Lanjut',
  submitting: 'Menyimpan…',
  failedTitle: 'Profil belum tersimpan',
  failedMessage: 'Cek koneksimu dan coba lagi.',
  conflictTitle: 'Kamu sudah punya profil perusahaan',
  toDashboard: 'Ke dashboard',
}

export const dashboardCopy = {
  loading: 'Memuat dashboard…',
  loadFailedTitle: 'Nggak bisa memuat',
  loadFailedMessage: 'Cek koneksimu dan coba lagi.',
  retry: 'Coba lagi',

  fundLabel: 'Dana payroll',
  runwayDays: (n: number) => `Cukup ±${n} hari`,
  runwayLowBadge: (n: number) => `Dana cukup ±${n} hari`,
  runwayCriticalBadge: (n: number) => `Dana tinggal ±${n} hari`,
  fundEmptyBadge: 'Dana habis',
  runwayNoWorkers: 'Belum ada gaji yang mengalir',
  topUp: 'Top up',
  comingSoon: 'Segera hadir',

  criticalTitle: (n: number) => `Dana tinggal ±${n} hari`,
  criticalMessage: 'Kalau dana habis, gaji pekerjamu berhenti mengalir. Top up sebelum habis.',
  fundEmptyTitle: 'Aliran gaji dijeda',
  fundEmptyMessage: (workers: number) =>
    `Dana payroll habis. ${workers} pekerja berhenti menerima gaji sampai dana diisi lagi.`,

  activeWorkers: 'Pekerja aktif',
  monthlyPayroll: 'Gaji per bulan',

  tabsLabel: 'Pekerja dan undangan',
  tabWorkers: 'Pekerja',
  tabInvites: 'Undangan',

  workerSince: (date: string, streamed: string) => `Sejak ${date} · ${streamed} mengalir`,
  perMonth: '/bulan',
  colName: 'Nama',
  colSalary: 'Gaji per bulan',
  colJoined: 'Bergabung',
  colStreamed: 'Sudah mengalir',
  noWorkersYet:
    'Belum ada pekerja yang bergabung. Undangan yang sudah dikirim ada di tab Undangan.',

  noWorkersTitle: 'Belum ada pekerja',
  noWorkersBody:
    'Undang pekerjamu lewat link. Gajinya mulai mengalir tiap detik begitu undangan diterima.',
  inviteFirst: 'Undang pekerja pertamamu',
  inviteWorker: 'Undang pekerja',

  noInvites: 'Belum ada undangan.',
  invitePending: 'Menunggu',
  inviteAccepted: 'Diterima',
  inviteRevoked: 'Dibatalkan',
  inviteExpired: 'Kedaluwarsa',
  daysLeft: (n: number) => (n <= 1 ? 'Berakhir hari ini' : `Sisa ${n} hari`),
  acceptedOn: (date: string) => `Diterima ${date}`,
  createdOn: (date: string) => `Dibuat ${date}`,
  salaryPerMonth: (usd: number) => `${formatUsd(usd)}/bulan`,
  copyLink: 'Salin link',
  copied: 'Link tersalin',
  revoke: 'Batalkan',
}

export const inviteSheetCopy = {
  title: 'Undang pekerja',
  description: 'Buat link undangan, lalu kirim ke pekerjamu.',
  nameLabel: 'Nama pekerja',
  namePlaceholder: 'Mis. Siti Aminah',
  nameRequired: 'Isi nama pekerja.',
  salaryLabel: 'Gaji bulanan (USD)',
  salaryRequired: 'Isi gaji bulanan.',
  salaryInvalid: 'Gaji harus angka lebih dari 0, maksimal 2 angka di belakang koma.',
  salaryTooHigh: 'Gaji maksimal $1.000.000 per bulan.',
  perDay: (usd: number) => `= ${formatUsd(usd)}/hari`,
  perDayHint: 'Gaji mengalir tiap detik, dihitung per 30 hari.',
  submit: 'Buat link undangan',
  submitting: 'Membuat link…',
  failed: 'Link belum berhasil dibuat. Cek koneksimu dan coba lagi.',

  successTitle: 'Link siap dibagikan',
  successBody: (name: string) => `Kirim link ini ke ${name}. Berlaku 14 hari.`,
  linkLabel: 'Link undangan',
  shareWhatsApp: 'Bagikan via WhatsApp',
  copyLink: 'Salin link',
  copied: 'Link tersalin',
  inviteAnother: 'Undang pekerja lain',
  whatsappText: (name: string, company: string, url: string) =>
    `Halo ${name}, ${company} mengundang kamu bergabung di Trickle. ` +
    `Gajimu mengalir tiap detik dan bisa kamu tarik kapan saja. ` +
    `Buka link ini untuk menerima undangan:\n${url}`,
}

export const revokeCopy = {
  title: 'Batalkan undangan?',
  body: (name: string) =>
    `Link untuk ${name} tidak bisa dipakai lagi. Kamu bisa membuat undangan baru kapan saja.`,
  confirm: 'Ya, batalkan undangan',
  confirming: 'Membatalkan…',
  cancel: 'Tidak jadi',
  failed: 'Undangan belum berhasil dibatalkan. Coba lagi.',
}
