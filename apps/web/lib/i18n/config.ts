// Bahasa yang didukung. Tambah bahasa baru di sini, lalu isi kamus di lib/copy/*.

export const LOCALES = ['id', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'id'
export const LOCALE_COOKIE = 'trickle-lang'
/** Satu tahun. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Nama bahasa ditulis dalam bahasanya sendiri, supaya mudah ditemukan. */
export const LOCALE_NAMES: Record<Locale, string> = {
  id: 'Bahasa Indonesia',
  en: 'English',
}

/** Kode BCP 47 untuk Intl (angka, tanggal). */
export const INTL_LOCALE: Record<Locale, string> = {
  id: 'id-ID',
  en: 'en-US',
}

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value)

/**
 * Pilih bahasa dari pilihan tersimpan, lalu dari preferensi bahasa browser
 * (`Accept-Language`, yang mencerminkan pengaturan HP dan negara pengguna):
 * ada bahasa Indonesia di daftar → `id`, selain itu → `en`.
 */
export function pickLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(saved)) return saved
  if (!acceptLanguage) return DEFAULT_LOCALE
  const tags = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0]?.trim().toLowerCase())
    .filter(Boolean)
  if (tags.length === 0) return DEFAULT_LOCALE
  // `in` adalah kode lama untuk bahasa Indonesia yang masih dikirim beberapa HP Android.
  return tags.some((tag) => tag?.startsWith('id') || tag?.startsWith('in')) ? 'id' : 'en'
}
