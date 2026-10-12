// Teks UI untuk login dan sesi (DESIGN.md 6.2, 8). Tanpa istilah crypto.

export const authCopy = {
  unconfiguredTitle: 'Login belum tersedia',
  unconfiguredMessage: 'Layanan login belum disiapkan di aplikasi ini. Coba lagi nanti.',
  toHome: 'Ke beranda',

  signInTitle: 'Masuk dulu, ya',
  signInMessage: 'Masuk pakai email atau Google untuk mengelola perusahaan dan pekerjamu.',
  signIn: 'Masuk dengan email/Google',
  signInFailed: 'Halaman login belum bisa dibuka. Coba lagi sebentar.',
  loading: 'Menyiapkan akunmu…',
}

/** Pesan error API per kondisi (bukan `code` mentah). */
export const apiErrorCopy = {
  network: {
    title: 'Nggak bisa terhubung',
    message: 'Cek koneksimu dan coba lagi.',
  },
  unauthorized: {
    title: 'Sesi perlu diperbarui',
    message: 'Masuk lagi untuk melanjutkan.',
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
  generic: {
    title: 'Nggak bisa memuat',
    message: 'Ada yang salah di sisi kami. Coba lagi.',
  },
  retry: 'Coba lagi',
}
