// Teks umum lintas halaman per bahasa.

import type { Locale } from '@/lib/i18n/config'

const id = {
  close: 'Tutup',
  splash: {
    loading: 'Memuat Trickle',
    slow: 'Masih memuat…',
  },
  theme: {
    toDark: 'Ganti ke tema gelap',
    toLight: 'Ganti ke tema terang',
    toggle: 'Ganti tema',
  },
  language: {
    button: 'Bahasa',
    sheetTitle: 'Pilih bahasa',
    sheetDescription: 'Teks dan format angka akan menyesuaikan.',
  },
}

export type CommonCopy = typeof id

const en: CommonCopy = {
  close: 'Close',
  splash: {
    loading: 'Loading Trickle',
    slow: 'Still loading…',
  },
  theme: {
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
    toggle: 'Switch theme',
  },
  language: {
    button: 'Language',
    sheetTitle: 'Choose language',
    sheetDescription: 'Text and number formats will update.',
  },
}

export const commonCopy: Record<Locale, CommonCopy> = { id, en }
