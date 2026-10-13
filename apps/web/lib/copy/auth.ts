// Teks UI untuk login, sesi, dan error API per bahasa (DESIGN.md 6.2, 8). Tanpa istilah crypto.

import type { Locale } from '@/lib/i18n/config'

const id = {
  auth: {
    unconfiguredTitle: 'Login belum tersedia',
    unconfiguredMessage: 'Layanan login belum disiapkan di aplikasi ini. Coba lagi nanti.',
    toHome: 'Ke beranda',
    signInTitle: 'Masuk dulu, ya',
    signInMessage: 'Masuk pakai email atau Google untuk mengelola perusahaan dan pekerjamu.',
    signIn: 'Masuk dengan email/Google',
    signInFailed: 'Halaman login belum bisa dibuka. Coba lagi sebentar.',
    loading: 'Menyiapkan akunmu…',
    retry: 'Coba lagi',
    signOut: 'Keluar',
  },
  /** Pesan error API per kondisi (bukan `code` mentah). */
  apiError: {
    network: { title: 'Nggak bisa terhubung', message: 'Cek koneksimu dan coba lagi.' },
    unauthorized: { title: 'Sesi perlu diperbarui', message: 'Masuk lagi untuk melanjutkan.' },
    forbidden: {
      title: 'Akses ditolak',
      message:
        'Akun ini belum punya izin untuk tindakan ini. Pastikan kamu masuk dengan akun perusahaan.',
    },
    walletNotReady: {
      title: 'Akunmu masih disiapkan',
      message: 'Biasanya cuma beberapa detik. Coba lagi sebentar.',
    },
    rateLimited: {
      title: 'Terlalu banyak permintaan',
      message: 'Tunggu sebentar, lalu coba lagi.',
    },
    unavailable: {
      title: 'Layanan sedang tidak tersedia',
      message: 'Server belum siap menerima login. Coba lagi nanti.',
    },
    generic: { title: 'Nggak bisa memuat', message: 'Ada yang salah di sisi kami. Coba lagi.' },
  },
}

export type AuthCopy = typeof id

const en: AuthCopy = {
  auth: {
    unconfiguredTitle: 'Sign-in isn’t available yet',
    unconfiguredMessage: 'Sign-in hasn’t been set up for this app yet. Please try again later.',
    toHome: 'Go to home',
    signInTitle: 'Sign in first',
    signInMessage: 'Sign in with email or Google to manage your company and workers.',
    signIn: 'Sign in with email/Google',
    signInFailed: 'The sign-in page couldn’t open. Try again in a moment.',
    loading: 'Setting up your account…',
    retry: 'Try again',
    signOut: 'Sign out',
  },
  apiError: {
    network: { title: 'Can’t connect', message: 'Check your connection and try again.' },
    unauthorized: { title: 'Session needs refreshing', message: 'Sign in again to continue.' },
    forbidden: {
      title: 'Access denied',
      message:
        'This account isn’t allowed to do this. Make sure you’re signed in with your company account.',
    },
    walletNotReady: {
      title: 'Your account is still being set up',
      message: 'This usually takes a few seconds. Try again shortly.',
    },
    rateLimited: { title: 'Too many requests', message: 'Wait a moment, then try again.' },
    unavailable: {
      title: 'Service unavailable',
      message: 'The server isn’t ready for sign-in yet. Please try again later.',
    },
    generic: { title: 'Couldn’t load', message: 'Something went wrong on our side. Try again.' },
  },
}

export const authCopy: Record<Locale, AuthCopy> = { id, en }
