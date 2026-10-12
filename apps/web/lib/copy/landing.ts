// Teks landing per bahasa, dibagi dua sisi: pekerja (`/`) dan perusahaan (`/perusahaan`).
// Bahasa umum, tanpa istilah teknis (DESIGN.md 1, 8). Tiap kalimat membawa fakta atau aksi.

import type { Locale } from '@/lib/i18n/config'

/** Kurs tetap untuk hitungan contoh: sama dengan kurs cadangan server, selalu diberi label estimasi. */
export const ESTIMATE_RATE_IDR_PER_USD = 16_500

/** Pembagian contoh di hero pekerja. */
export const EXAMPLE_FAMILY_PCT = 30

interface Step {
  title: string
  body: string
}

interface Faq {
  q: string
  a: string
}

const id = {
  nav: {
    signIn: 'Masuk',
  },

  worker: {
    meta: {
      title: 'Trickle · Gaji mengalir tiap detik',
      description:
        'Gaji pekerja migran mengalir tiap detik. Tarik kapan saja, dan kirim sebagian ke keluarga dalam Rupiah.',
    },
    hero: {
      title: 'Gaji mengalir',
      subtitle: 'Tiap detik. Tarik kapan saja.',
      body: 'Untuk pekerja migran: gaji bertambah setiap detik kamu bekerja, dan sebagian bisa langsung dikirim ke keluarga di Indonesia.',
      cardLabel: 'Gaji tersedia',
      cardRate: (perSecond: string) => `+${perSecond}/detik`,
      cardExample: 'Contoh',
      cardSplitTitle: 'Kalau ditarik sekarang',
      cardForYou: 'Untukmu',
      cardForFamily: (pct: number) => `Ibu · ${pct}%`,
      cardSrSummary:
        'Contoh: gaji tersedia bertambah sekitar lima rupiah setiap detik, dan tiga puluh persen otomatis untuk Ibu saat ditarik.',
      primary: 'Masuk',
      secondary: 'Lihat cara kerjanya',
      hint: 'Belum punya link? Minta ke bagian HR atau atasanmu.',
    },
    compare: {
      title: 'Bedanya',
      usually: 'Biasanya',
      withTrickle: 'Dengan Trickle',
      rows: [
        {
          topic: 'Gajian',
          usually: 'Sebulan sekali, di tanggal yang sama.',
          withTrickle: 'Bertambah tiap detik. Tarik saat butuh.',
        },
        {
          topic: 'Kirim ke keluarga',
          usually: 'Datang ke agen, isi formulir, bayar biaya kirim sekitar 6%.',
          withTrickle: 'Bagian keluarga terkirim otomatis setiap kamu tarik gaji.',
        },
        {
          topic: 'Sampai di keluarga',
          usually: 'Bisa makan waktu berhari-hari.',
          withTrickle: 'Keluarga melihat kirimannya saat itu juga, lalu mencairkannya ke rekening.',
        },
      ],
      source: 'Biaya kirim: rata-rata global menurut Bank Dunia.',
    },
    how: {
      title: 'Cara kerjanya',
      steps: [
        {
          title: 'Terima link undangan dari perusahaan',
          body: 'Buka link-nya dari WhatsApp, lalu masuk pakai email atau Google.',
        },
        {
          title: 'Gajimu bertambah tiap detik',
          body: 'Tarik kapan saja. Atur berapa persen yang langsung dikirim ke keluarga, sampai tiga orang.',
        },
        {
          title: 'Keluarga menerima bagiannya',
          body: 'Kiriman masuk setiap kamu menarik gaji, lalu bisa dicairkan ke rekening bank di Indonesia.',
        },
      ] as Step[],
    },
    calculator: {
      title: 'Hitung gajimu',
      salaryLabel: 'Gaji per bulan',
      familyLabel: 'Dikirim ke keluarga',
      familyValueText: (pct: number) => `${pct} persen`,
      receiptTitle: 'Perkiraan per bulan',
      forYou: 'Untukmu',
      forFamily: 'Untuk keluarga',
      perDay: 'Bertambah per hari',
      perSecond: 'Bertambah per detik',
      rateNote: (rate: string) =>
        `Estimasi dengan kurs ${rate} per $1. Angka sebenarnya bisa berbeda.`,
    },
    faq: {
      title: 'Pertanyaan',
      items: [
        {
          q: 'Perlu pasang aplikasi?',
          a: 'Nggak harus. Trickle dibuka dari browser HP, dan bisa dipasang di layar utama supaya terasa seperti aplikasi.',
        },
        {
          q: 'Masuknya pakai apa?',
          a: 'Email atau akun Google. Nggak perlu kartu atau dokumen khusus.',
        },
        {
          q: 'Berapa orang keluarga yang bisa menerima?',
          a: 'Sampai tiga orang. Persentase untuk masing-masing bisa kamu atur.',
        },
        {
          q: 'Ada biayanya?',
          a: 'Selama masa uji coba, nggak ada biaya apa pun.',
        },
      ] as Faq[],
    },
    closing: {
      title: 'Sudah diundang',
      body: 'Buka link undangan dari perusahaanmu, atau masuk kalau sudah bergabung.',
      action: 'Masuk',
      hint: 'Belum punya link? Minta ke bagian HR atau atasanmu.',
    },
  },

  company: {
    meta: {
      title: 'Trickle untuk perusahaan · Bayar gaji tiap detik',
      description:
        'Undang pekerja lewat link, siapkan gaji untuk satu periode, dan biarkan Trickle mengalirkannya tiap detik. Bagian keluarga terkirim otomatis.',
    },
    hero: {
      title: 'Bayar tiap detik',
      subtitle: 'Pekerja menerima gajinya selama bekerja.',
      body: 'Siapkan gaji sekali untuk satu periode. Trickle mengalirkannya ke pekerja tiap detik, dan bagian untuk keluarga mereka terkirim otomatis.',
      primary: 'Daftarkan perusahaan',
      secondary: 'Lihat cara kerjanya',
      preview: {
        example: 'Contoh',
        company: 'Maju Bersama Sdn Bhd',
        activeWorkers: 'Pekerja aktif',
        monthlyPayroll: 'Gaji per bulan',
        perMonth: '/bulan',
        invitesTitle: 'Undangan',
        pending: 'Menunggu',
        srSummary:
          'Contoh dashboard perusahaan: tiga pekerja aktif dengan total gaji dua ribu empat ratus dolar per bulan, dan satu undangan yang menunggu.',
      },
    },
    benefits: {
      title: 'Kenapa Trickle',
      rows: [
        {
          title: 'Undang dengan satu link',
          body: 'Tanpa formulir panjang. Pekerja menerima undangan dari HP, lalu langsung bergabung.',
        },
        {
          title: 'Kiriman ke keluarga sudah diurus',
          body: 'Pekerja mengatur sendiri bagian untuk keluarganya. Perusahaan cukup menyiapkan gaji.',
        },
        {
          title: 'Gaji dalam dolar AS',
          body: 'Atur gaji bulanan dalam USD. Pekerja melihat perkiraannya dalam Rupiah.',
        },
        {
          title: 'Semua di satu tempat',
          body: 'Daftar pekerja, gaji bulanan, dan undangan yang menunggu ada di satu dashboard.',
        },
      ] as Step[],
    },
    how: {
      title: 'Cara kerjanya',
      steps: [
        {
          title: 'Daftarkan perusahaan',
          body: 'Isi nama perusahaan dan negara. Masuk pakai email atau Google.',
        },
        {
          title: 'Undang pekerja lewat WhatsApp',
          body: 'Isi nama dan gaji bulanan, lalu bagikan link undangannya. Link berlaku 14 hari.',
        },
        {
          title: 'Siapkan gaji untuk satu periode',
          body: 'Misalnya gaji sebulan. Gaji mengalir ke pekerja tiap detik selama periode itu.',
        },
        {
          title: 'Pantau dari dashboard',
          body: 'Lihat siapa saja yang sudah bergabung, gaji bulanan, dan undangan yang menunggu.',
        },
      ] as Step[],
    },
    faq: {
      title: 'Pertanyaan',
      items: [
        {
          q: 'Perusahaan dari negara mana yang bisa daftar?',
          a: 'Saat ini Malaysia, Singapura, Hong Kong, Taiwan, Arab Saudi, Jepang, dan Korea Selatan.',
        },
        {
          q: 'Apa yang dibutuhkan pekerja?',
          a: 'HP dengan browser, dan email atau akun Google. Nggak perlu pasang aplikasi.',
        },
        {
          q: 'Bisa membatalkan undangan?',
          a: 'Bisa, selama belum diterima. Link yang dibatalkan langsung nggak bisa dipakai.',
        },
        {
          q: 'Ada biayanya?',
          a: 'Selama masa uji coba, nggak ada biaya apa pun.',
        },
      ] as Faq[],
    },
    closing: {
      title: 'Siap mulai',
      body: 'Daftarkan perusahaan, lalu kirim link undangan ke pekerja pertamamu.',
      action: 'Daftarkan perusahaan',
    },
  },

  chooser: {
    title: 'Kamu membuka Trickle sebagai…',
    worker: {
      title: 'Pekerja',
      body: 'Lihat gajimu bertambah tiap detik, tarik kapan saja, dan kirim sebagian ke keluarga.',
    },
    company: {
      title: 'Perusahaan',
      body: 'Undang pekerja lewat link dan bayar gaji mereka tiap detik.',
    },
    browse: 'Lihat dulu saja',
    note: 'Salah pilih? Ada link untuk pindah di bagian bawah halaman.',
  },

  testNote: 'Trickle masih dalam mode uji. Belum ada uang sungguhan yang dipindahkan.',
  footer: {
    disclaimer: 'Prototipe dalam mode uji. Bukan layanan keuangan berlisensi.',
    switchTo: {
      worker: 'Kamu pekerja? Lihat halaman untuk pekerja',
      company: 'Kamu dari perusahaan? Lihat halaman untuk perusahaan',
    },
  },
}

export type LandingCopy = typeof id

const en: LandingCopy = {
  nav: {
    signIn: 'Sign in',
  },

  worker: {
    meta: {
      title: 'Trickle · Pay that flows every second',
      description:
        'Migrant workers earn their pay every second. Withdraw anytime, and send part of it home to family in Indonesia.',
    },
    hero: {
      title: 'Pay that flows',
      subtitle: 'Every second. Withdraw anytime.',
      body: 'For migrant workers: pay grows with every second you work, and part of it can go straight to family in Indonesia.',
      cardLabel: 'Available pay',
      cardRate: (perSecond: string) => `+${perSecond}/sec`,
      cardExample: 'Example',
      cardSplitTitle: 'If withdrawn now',
      cardForYou: 'For you',
      cardForFamily: (pct: number) => `Mom · ${pct}%`,
      cardSrSummary:
        'Example: available pay grows by about five rupiah every second, and thirty percent goes to Mom automatically on withdrawal.',
      primary: 'Sign in',
      secondary: 'See how it works',
      hint: 'No link yet? Ask your HR team or supervisor.',
    },
    compare: {
      title: 'The difference',
      usually: 'Usually',
      withTrickle: 'With Trickle',
      rows: [
        {
          topic: 'Payday',
          usually: 'Once a month, on a fixed date.',
          withTrickle: 'Grows every second. Withdraw when you need it.',
        },
        {
          topic: 'Sending money home',
          usually: 'Visit an agent, fill in forms, pay about 6% in fees.',
          withTrickle: 'Family’s share is sent automatically every time you withdraw.',
        },
        {
          topic: 'Reaching family',
          usually: 'Can take days.',
          withTrickle: 'Family sees it right away, then cashes out to their bank account.',
        },
      ],
      source: 'Sending fee: global average according to the World Bank.',
    },
    how: {
      title: 'How it works',
      steps: [
        {
          title: 'Get an invite link from your company',
          body: 'Open it from WhatsApp, then sign in with email or Google.',
        },
        {
          title: 'Your pay grows every second',
          body: 'Withdraw anytime. Choose what percentage goes straight to family, for up to three people.',
        },
        {
          title: 'Family receives their share',
          body: 'It arrives every time you withdraw, and can be cashed out to a bank account in Indonesia.',
        },
      ],
    },
    calculator: {
      title: 'Estimate your pay',
      salaryLabel: 'Monthly pay',
      familyLabel: 'Sent to family',
      familyValueText: (pct: number) => `${pct} percent`,
      receiptTitle: 'Estimated per month',
      forYou: 'For you',
      forFamily: 'For family',
      perDay: 'Grows per day',
      perSecond: 'Grows per second',
      rateNote: (rate: string) => `Estimate at ${rate} per $1. Actual amounts may differ.`,
    },
    faq: {
      title: 'Questions',
      items: [
        {
          q: 'Do I need to install an app?',
          a: 'No. Trickle opens in your phone’s browser, and you can add it to your home screen so it feels like an app.',
        },
        {
          q: 'How do I sign in?',
          a: 'With email or a Google account. No special card or documents needed.',
        },
        {
          q: 'How many family members can receive money?',
          a: 'Up to three. You choose the percentage for each person.',
        },
        {
          q: 'Are there any fees?',
          a: 'There are no fees during the trial period.',
        },
      ],
    },
    closing: {
      title: 'Already invited',
      body: 'Open the invite link from your company, or sign in if you’ve already joined.',
      action: 'Sign in',
      hint: 'No link yet? Ask your HR team or supervisor.',
    },
  },

  company: {
    meta: {
      title: 'Trickle for companies · Pay by the second',
      description:
        'Invite workers with a link, set aside pay for a period, and let Trickle release it every second. Family shares are sent automatically.',
    },
    hero: {
      title: 'Pay by the second',
      subtitle: 'Your workers earn while they work.',
      body: 'Set aside pay once for a period. Trickle releases it to workers every second, and their family’s share is sent automatically.',
      primary: 'Register your company',
      secondary: 'See how it works',
      preview: {
        example: 'Example',
        company: 'Maju Bersama Sdn Bhd',
        activeWorkers: 'Active workers',
        monthlyPayroll: 'Monthly payroll',
        perMonth: '/month',
        invitesTitle: 'Invites',
        pending: 'Pending',
        srSummary:
          'Example company dashboard: three active workers with total pay of two thousand four hundred dollars a month, and one pending invite.',
      },
    },
    benefits: {
      title: 'Why Trickle',
      rows: [
        {
          title: 'Invite with one link',
          body: 'No long forms. Workers accept the invite on their phone and join right away.',
        },
        {
          title: 'Sending money home is handled',
          body: 'Workers set their family’s share themselves. You only set aside the pay.',
        },
        {
          title: 'Pay in US dollars',
          body: 'Set monthly pay in USD. Workers see the estimate in Indonesian rupiah.',
        },
        {
          title: 'Everything in one place',
          body: 'Your workers, monthly pay, and pending invites are all on one dashboard.',
        },
      ],
    },
    how: {
      title: 'How it works',
      steps: [
        {
          title: 'Register your company',
          body: 'Enter your company name and country. Sign in with email or Google.',
        },
        {
          title: 'Invite workers on WhatsApp',
          body: 'Enter a name and monthly pay, then share the invite link. Links are valid for 14 days.',
        },
        {
          title: 'Set aside pay for a period',
          body: 'A month of pay, for example. It flows to the worker every second during that period.',
        },
        {
          title: 'Track it on your dashboard',
          body: 'See who has joined, their monthly pay, and which invites are still pending.',
        },
      ],
    },
    faq: {
      title: 'Questions',
      items: [
        {
          q: 'Which countries can companies register from?',
          a: 'Currently Malaysia, Singapore, Hong Kong, Taiwan, Saudi Arabia, Japan, and South Korea.',
        },
        {
          q: 'What do workers need?',
          a: 'A phone with a browser, and an email or Google account. No app to install.',
        },
        {
          q: 'Can I cancel an invite?',
          a: 'Yes, as long as it hasn’t been accepted. A cancelled link stops working right away.',
        },
        {
          q: 'Are there any fees?',
          a: 'There are no fees during the trial period.',
        },
      ],
    },
    closing: {
      title: 'Ready to start',
      body: 'Register your company, then send an invite link to your first worker.',
      action: 'Register your company',
    },
  },

  chooser: {
    title: 'You’re opening Trickle as…',
    worker: {
      title: 'A worker',
      body: 'Watch your pay grow every second, withdraw anytime, and send part of it to family.',
    },
    company: {
      title: 'A company',
      body: 'Invite workers with a link and pay them every second.',
    },
    browse: 'Just looking for now',
    note: 'Picked the wrong one? There’s a link to switch at the bottom of the page.',
  },

  testNote: 'Trickle is in test mode. No real money is moved yet.',
  footer: {
    disclaimer: 'Prototype in test mode. Not a licensed financial service.',
    switchTo: {
      worker: 'Are you a worker? See the page for workers',
      company: 'From a company? See the page for companies',
    },
  },
}

export const landingCopy: Record<Locale, LandingCopy> = { id, en }
