'use client'

import { employerCopy } from '@/lib/copy/employer'
import { useLocale } from '@/lib/i18n/client'

/** Kamus area perusahaan untuk bahasa aktif, plus `locale` untuk formatter angka dan tanggal. */
export function useEmployerCopy() {
  const { locale } = useLocale()
  return { copy: employerCopy[locale], locale }
}
