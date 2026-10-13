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

    fundLabel: 'Gaji yang sudah didanai',
    fundHint: 'Terkunci dan belum mengalir ke pekerja.',
    runwayDays: (n: number) => `Aliran terdekat berakhir ±${n} hari lagi`,
    runwayLowBadge: (n: number) => `Berakhir ±${n} hari lagi`,
    runwayCriticalBadge: (n: number) => `Berakhir ±${n} hari lagi`,
    endedBadge: 'Aliran gaji berakhir',
    unfundedHint: 'Belum ada gaji yang didanai.',
    runwayNoWorkers: 'Belum ada gaji yang mengalir',
    walletLabel: 'Saldo di akunmu',
    testMode: 'Mode uji',
    fundAction: 'Danai gaji',

    criticalTitle: (n: number) => `Aliran gaji berakhir ±${n} hari lagi`,
    criticalMessage: 'Danai periode berikutnya supaya gaji pekerjamu tetap mengalir tanpa jeda.',
    endedTitle: 'Gaji pekerjamu sedang tidak mengalir',
    endedMessage: (workers: number) =>
      `${workers} pekerja tidak menerima gaji sampai kamu mendanai periode berikutnya.`,

    payActive: (date: string) => `Mengalir sampai ${date}`,
    payScheduled: (date: string) => `Mulai mengalir ${date}`,
    payEnded: (date: string) => `Berakhir ${date}`,
    payUnfunded: 'Belum didanai',
    fundWorker: 'Danai',
    stopWorker: 'Hentikan',
    colStatus: 'Status gaji',
    colActions: 'Aksi',

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

  fundSheet: {
    title: 'Danai gaji',
    description: 'Gaji dikunci dan mengalir ke pekerja tiap detik selama periode yang dipilih.',
    workerLabel: 'Pekerja',
    periodLabel: 'Periode',
    period: (days: number): string =>
      days === 7 ? '1 minggu' : days === 14 ? '2 minggu' : '1 bulan',
    amountLabel: 'Jumlah',
    perDay: (usd: string) => `= ${usd}/hari`,
    startNow: (end: string) => `Mulai sekarang, berakhir ${end}`,
    startAfter: (start: string, end: string) =>
      `Mulai ${start} setelah aliran sekarang berakhir, sampai ${end}`,
    testNote: 'Mode uji: kalau saldomu kurang, dana uji dibuat otomatis. Belum ada uang sungguhan.',
    submit: (amount: string) => `Danai gaji ${amount}`,
    steps: {
      preparing: 'Menyiapkan akun…',
      minting: 'Menyiapkan dana uji…',
      approving: 'Memberi izin pembayaran…',
      creating: 'Membuat aliran gaji…',
      cancelling: 'Menghentikan aliran…',
    },
    stepsNote: 'Jangan tutup halaman ini sampai selesai.',
    successTitle: 'Gaji sudah didanai',
    successBody: (name: string, end: string) => `Gaji ${name} mengalir tiap detik sampai ${end}.`,
    done: 'Selesai',
    failedTitle: 'Gaji belum berhasil didanai',
    unknownTitle: 'Belum terkonfirmasi',
    unknownBody:
      'Transaksi sudah dikirim tapi hasilnya belum pasti. Cek status gaji di daftar pekerja sebelum mencoba lagi, supaya tidak terdanai dua kali.',
    retry: 'Coba lagi',
  },

  stopSheet: {
    title: 'Hentikan aliran gaji?',
    body: (name: string) =>
      `Gaji ${name} berhenti mengalir sekarang. Bagian yang sudah mengalir tetap milik ${name}, sisanya kembali ke saldomu.`,
    confirm: 'Ya, hentikan aliran',
    confirming: 'Menghentikan…',
    cancel: 'Tidak jadi',
    successTitle: 'Aliran gaji dihentikan',
    done: 'Selesai',
  },

  fundingErrors: {
    gas: 'Biaya transaksi belum siap. Coba lagi sebentar.',
    funds: 'Saldo di akunmu tidak cukup untuk jumlah ini.',
    wallet: 'Akunmu berubah atau belum siap. Muat ulang halaman, lalu coba lagi.',
    rejected: 'Transaksi ditolak. Periksa data pekerja dan periode, lalu coba lagi.',
    service: 'Layanan pembayaran sedang tidak tersedia. Coba lagi nanti.',
    generic: 'Ada yang tidak berjalan semestinya. Coba lagi.',
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

    fundLabel: 'Pay already funded',
    fundHint: 'Locked in and not yet paid out to workers.',
    runwayDays: (n: number) => `Nearest pay stream ends in about ${n} days`,
    runwayLowBadge: (n: number) => `Ends in about ${n} days`,
    runwayCriticalBadge: (n: number) => `Ends in about ${n} days`,
    endedBadge: 'Pay streams ended',
    unfundedHint: 'No pay funded yet.',
    runwayNoWorkers: 'No pay flowing yet',
    walletLabel: 'Your balance',
    testMode: 'Test mode',
    fundAction: 'Fund pay',

    criticalTitle: (n: number) => `Pay streams end in about ${n} days`,
    criticalMessage: 'Fund the next period so your workers’ pay keeps flowing without a gap.',
    endedTitle: 'Your workers’ pay isn’t flowing',
    endedMessage: (workers: number) =>
      `${workers} ${workers === 1 ? 'worker isn’t' : 'workers aren’t'} receiving pay until you fund the next period.`,

    payActive: (date: string) => `Flowing until ${date}`,
    payScheduled: (date: string) => `Starts flowing ${date}`,
    payEnded: (date: string) => `Ended ${date}`,
    payUnfunded: 'Not funded',
    fundWorker: 'Fund',
    stopWorker: 'Stop',
    colStatus: 'Pay status',
    colActions: 'Actions',

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

  fundSheet: {
    title: 'Fund pay',
    description: 'Pay is locked in and flows to the worker every second for the chosen period.',
    workerLabel: 'Worker',
    periodLabel: 'Period',
    period: (days: number) => (days === 7 ? '1 week' : days === 14 ? '2 weeks' : '1 month'),
    amountLabel: 'Amount',
    perDay: (usd: string) => `= ${usd}/day`,
    startNow: (end: string) => `Starts now, ends ${end}`,
    startAfter: (start: string, end: string) =>
      `Starts ${start} when the current stream ends, until ${end}`,
    testNote:
      'Test mode: if your balance is short, test funds are created automatically. No real money yet.',
    submit: (amount: string) => `Fund ${amount} in pay`,
    steps: {
      preparing: 'Preparing your account…',
      minting: 'Creating test funds…',
      approving: 'Approving the payment…',
      creating: 'Starting the pay stream…',
      cancelling: 'Stopping the stream…',
    },
    stepsNote: 'Keep this page open until it’s done.',
    successTitle: 'Pay is funded',
    successBody: (name: string, end: string) => `${name}’s pay flows every second until ${end}.`,
    done: 'Done',
    failedTitle: 'Pay wasn’t funded',
    unknownTitle: 'Not confirmed yet',
    unknownBody:
      'The transaction was sent but the result isn’t certain yet. Check the pay status in your worker list before trying again, so you don’t fund twice.',
    retry: 'Try again',
  },

  stopSheet: {
    title: 'Stop this pay stream?',
    body: (name: string) =>
      `${name}’s pay stops flowing now. What has already flowed stays with ${name}, and the rest returns to your balance.`,
    confirm: 'Yes, stop the stream',
    confirming: 'Stopping…',
    cancel: 'Keep it',
    successTitle: 'Pay stream stopped',
    done: 'Done',
  },

  fundingErrors: {
    gas: 'Transaction fees aren’t ready yet. Try again shortly.',
    funds: 'Your balance isn’t enough for this amount.',
    wallet: 'Your account changed or isn’t ready. Reload the page and try again.',
    rejected: 'The transaction was rejected. Check the worker and period, then try again.',
    service: 'The payment service is unavailable. Please try again later.',
    generic: 'Something didn’t work. Try again.',
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
