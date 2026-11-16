import { isApiError } from '@/lib/api/errors'
import type { Locale } from '@/lib/i18n/config'

const id = {
  title: 'Kiriman masuk',
  body: 'Bagian gaji yang otomatis dikirim setiap kali keluargamu menarik gaji.',
  loading: 'Memuat kiriman',
  emptyTitle: 'Belum ada kiriman',
  emptyBody: 'Kiriman akan muncul di sini setelah keluargamu menarik gaji.',
  idrEstimate: (value: string) => `≈ ${value}`,
  explorer: 'Lihat transaksi',
  explorerLabel: (name: string, date: string) => `Lihat transaksi kiriman dari ${name}, ${date}`,
  more: 'Muat kiriman lainnya',
  loadingMore: 'Memuat kiriman...',
  retry: 'Coba lagi',
  errors: {
    load: {
      title: 'Belum dapat memuat kiriman',
      message: 'Daftar kiriman belum dapat dimuat. Silakan coba lagi.',
    },
    page: {
      title: 'Kiriman berikutnya belum dapat dimuat',
      message: 'Kiriman yang sudah dimuat tetap ditampilkan. Silakan coba lagi.',
    },
    session: {
      title: 'Sesi perlu diperbarui',
      message: 'Perbarui sesi untuk memuat kiriman kembali.',
    },
  },
}
export type FamilyIncomingCopy = typeof id

const en: FamilyIncomingCopy = {
  title: 'Money received',
  body: 'The share of pay your family member sends you automatically each time they withdraw.',
  loading: 'Loading transfers',
  emptyTitle: 'Nothing received yet',
  emptyBody: 'Transfers will show up here after your family member withdraws their pay.',
  idrEstimate: (value: string) => `≈ ${value}`,
  explorer: 'View transaction',
  explorerLabel: (name: string, date: string) => `View the transfer from ${name}, ${date}`,
  more: 'Load more transfers',
  loadingMore: 'Loading transfers...',
  retry: 'Try again',
  errors: {
    load: {
      title: 'Couldn’t load transfers',
      message: 'Your transfers couldn’t be loaded. Please try again.',
    },
    page: {
      title: 'Couldn’t load more transfers',
      message: 'Transfers already loaded are still shown. Please try again.',
    },
    session: {
      title: 'Your session needs a refresh',
      message: 'Refresh your session to load your transfers again.',
    },
  },
}

export const familyIncomingCopy: Record<Locale, FamilyIncomingCopy> = { id, en }

export function incomingError(error: unknown, page: boolean, locale: Locale = 'id') {
  const t = familyIncomingCopy[locale]
  if (isApiError(error) && error.status === 401) return t.errors.session
  return page ? t.errors.page : t.errors.load
}
