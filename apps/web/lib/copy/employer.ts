// Teks UI area perusahaan (employer) per bahasa (DESIGN.md 8). Tanpa istilah crypto.

import { formatUsd } from '@/lib/format'
import type { Locale } from '@/lib/i18n/config'

/** Kode ISO 3166-1 alpha-2, sesuai API. Nama negara ada di kamus per bahasa. */
export const COUNTRY_CODES = ['MY', 'SG', 'HK', 'TW', 'SA', 'JP', 'KR'] as const
export type CountryCode = (typeof COUNTRY_CODES)[number]

const id = {
  countries: {
    MY: 'Malaysia',
    SG: 'Singapura',
    HK: 'Hong Kong',
    TW: 'Taiwan',
    SA: 'Arab Saudi',
    JP: 'Jepang',
    KR: 'Korea Selatan',
  } satisfies Record<CountryCode, string>,

  setup: {
    meta: 'Profil perusahaan · Trickle',
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
    conflictTitle: 'Kamu sudah punya profil perusahaan',
    toDashboard: 'Ke dashboard',
    loading: 'Memuat…',
  },

  dashboard: {
    meta: 'Dashboard · Trickle',
    heading: 'Dashboard perusahaan',
    companyLabel: 'Perusahaan:',
    loading: 'Memuat dashboard…',
    retry: 'Coba lagi',

    fundLabel: 'Dana payroll',
    fundUnavailable: 'Belum tersedia',
    fundUnavailableHint: 'Saldo dana dan sisa hari akan tampil setelah terhubung ke payroll.',
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
    pendingSuffix: 'menunggu',

    workerSince: (date: string, streamed: string) => `Sejak ${date} · ${streamed} mengalir`,
    workerSinceOnly: (date: string) => `Bergabung ${date}`,
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
    salaryPerMonth: (usd: number) => `${formatUsd(usd, 'id')}/bulan`,
    copyLink: 'Salin link',
    copied: 'Link tersalin',
    revoke: 'Batalkan',
  },

  inviteSheet: {
    title: 'Undang pekerja',
    description: 'Buat link undangan, lalu kirim ke pekerjamu.',
    nameLabel: 'Nama pekerja',
    namePlaceholder: 'Mis. Siti Aminah',
    nameRequired: 'Isi nama pekerja.',
    salaryLabel: 'Gaji bulanan (USD)',
    salaryRequired: 'Isi gaji bulanan.',
    salaryInvalid: 'Gaji harus angka lebih dari 0, maksimal 2 angka di belakang koma.',
    salaryTooHigh: 'Gaji maksimal $1.000.000 per bulan.',
    perDay: (usd: number) => `= ${formatUsd(usd, 'id')}/hari`,
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
  },

  revoke: {
    title: 'Batalkan undangan?',
    body: (name: string) =>
      `Link untuk ${name} tidak bisa dipakai lagi. Kamu bisa membuat undangan baru kapan saja.`,
    confirm: 'Ya, batalkan undangan',
    confirming: 'Membatalkan…',
    cancel: 'Tidak jadi',
    failed: 'Undangan belum berhasil dibatalkan. Coba lagi.',
  },
}

export type EmployerCopy = typeof id

const en: EmployerCopy = {
  countries: {
    MY: 'Malaysia',
    SG: 'Singapore',
    HK: 'Hong Kong',
    TW: 'Taiwan',
    SA: 'Saudi Arabia',
    JP: 'Japan',
    KR: 'South Korea',
  },

  setup: {
    meta: 'Company profile · Trickle',
    step: 'Step 1 of 1',
    title: 'What’s your company?',
    intro: 'Workers see this name when they accept your invite.',
    nameLabel: 'Company name',
    namePlaceholder: 'E.g. Maju Bersama Sdn Bhd',
    nameRequired: 'Enter your company name.',
    nameTooShort: 'Company name must be at least 2 characters.',
    countryLabel: 'Country',
    submit: 'Continue',
    submitting: 'Saving…',
    failedTitle: 'Profile not saved yet',
    conflictTitle: 'You already have a company profile',
    toDashboard: 'Go to dashboard',
    loading: 'Loading…',
  },

  dashboard: {
    meta: 'Dashboard · Trickle',
    heading: 'Company dashboard',
    companyLabel: 'Company:',
    loading: 'Loading dashboard…',
    retry: 'Try again',

    fundLabel: 'Payroll funds',
    fundUnavailable: 'Not available yet',
    fundUnavailableHint: 'Your balance and days remaining will appear once payroll is connected.',
    runwayDays: (n: number) => `Lasts about ${n} days`,
    runwayLowBadge: (n: number) => `Funds last about ${n} days`,
    runwayCriticalBadge: (n: number) => `About ${n} days of funds left`,
    fundEmptyBadge: 'Out of funds',
    runwayNoWorkers: 'No pay flowing yet',
    topUp: 'Top up',
    comingSoon: 'Coming soon',

    criticalTitle: (n: number) => `About ${n} days of funds left`,
    criticalMessage: 'When funds run out, your workers’ pay stops flowing. Top up before then.',
    fundEmptyTitle: 'Pay is paused',
    fundEmptyMessage: (workers: number) =>
      `Payroll funds are empty. ${workers} ${workers === 1 ? 'worker has' : 'workers have'} stopped receiving pay until funds are added.`,

    activeWorkers: 'Active workers',
    monthlyPayroll: 'Monthly payroll',

    tabsLabel: 'Workers and invites',
    tabWorkers: 'Workers',
    tabInvites: 'Invites',
    pendingSuffix: 'pending',

    workerSince: (date: string, streamed: string) => `Since ${date} · ${streamed} paid out`,
    workerSinceOnly: (date: string) => `Joined ${date}`,
    perMonth: '/month',
    colName: 'Name',
    colSalary: 'Monthly pay',
    colJoined: 'Joined',
    colStreamed: 'Paid so far',
    noWorkersYet: 'No workers have joined yet. Invites you sent are in the Invites tab.',

    noWorkersTitle: 'No workers yet',
    noWorkersBody:
      'Invite your workers with a link. Their pay starts flowing every second once they accept.',
    inviteFirst: 'Invite your first worker',
    inviteWorker: 'Invite worker',

    noInvites: 'No invites yet.',
    invitePending: 'Pending',
    inviteAccepted: 'Accepted',
    inviteRevoked: 'Cancelled',
    inviteExpired: 'Expired',
    daysLeft: (n: number) => (n <= 1 ? 'Ends today' : `${n} days left`),
    acceptedOn: (date: string) => `Accepted ${date}`,
    createdOn: (date: string) => `Created ${date}`,
    salaryPerMonth: (usd: number) => `${formatUsd(usd, 'en')}/month`,
    copyLink: 'Copy link',
    copied: 'Link copied',
    revoke: 'Cancel',
  },

  inviteSheet: {
    title: 'Invite worker',
    description: 'Create an invite link, then send it to your worker.',
    nameLabel: 'Worker name',
    namePlaceholder: 'E.g. Siti Aminah',
    nameRequired: 'Enter the worker’s name.',
    salaryLabel: 'Monthly pay (USD)',
    salaryRequired: 'Enter the monthly pay.',
    salaryInvalid: 'Pay must be a number above 0, with up to 2 decimal places.',
    salaryTooHigh: 'Pay can be at most $1,000,000 per month.',
    perDay: (usd: number) => `= ${formatUsd(usd, 'en')}/day`,
    perDayHint: 'Pay flows every second, calculated over 30 days.',
    submit: 'Create invite link',
    submitting: 'Creating link…',
    failed: 'The link couldn’t be created. Check your connection and try again.',

    successTitle: 'Link ready to share',
    successBody: (name: string) => `Send this link to ${name}. It’s valid for 14 days.`,
    linkLabel: 'Invite link',
    shareWhatsApp: 'Share on WhatsApp',
    copyLink: 'Copy link',
    copied: 'Link copied',
    inviteAnother: 'Invite another worker',
    whatsappText: (name: string, company: string, url: string) =>
      `Hi ${name}, ${company} has invited you to join Trickle. ` +
      `Your pay flows every second and you can withdraw it anytime. ` +
      `Open this link to accept the invite:\n${url}`,
  },

  revoke: {
    title: 'Cancel this invite?',
    body: (name: string) =>
      `The link for ${name} will stop working. You can create a new invite anytime.`,
    confirm: 'Yes, cancel invite',
    confirming: 'Cancelling…',
    cancel: 'Keep invite',
    failed: 'The invite couldn’t be cancelled. Try again.',
  },
}

export const employerCopy: Record<Locale, EmployerCopy> = { id, en }
