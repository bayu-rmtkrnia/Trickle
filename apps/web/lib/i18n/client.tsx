'use client'

import { useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from './config'

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/** Bahasa awal datang dari server (cookie atau `Accept-Language`), jadi tidak ada kedipan. */
export function LocaleProvider({ initial, children }: { initial: Locale; children: ReactNode }) {
  const router = useRouter()
  const [locale, setState] = useState(initial)

  const setLocale = useCallback(
    (next: Locale) => {
      setState(next)
      document.documentElement.lang = next
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
      // Render ulang bagian server (teks, metadata) dengan bahasa baru.
      router.refresh()
    },
    [router],
  )

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** Tanpa provider (mis. test komponen tunggal) jatuh ke bahasa default, supaya komponen bersama tetap aman dipakai. */
const FALLBACK: LocaleContextValue = { locale: DEFAULT_LOCALE, setLocale: () => {} }

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? FALLBACK
}

/** Ambil kamus untuk bahasa aktif: `const t = useDict(employerCopy)`. */
export function useDict<T>(dictionary: Record<Locale, T>): T {
  return dictionary[useLocale().locale]
}
