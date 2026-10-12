'use client'

import { useState } from 'react'
import { commonCopy } from '@/lib/copy/common'
import { useDict, useLocale } from '@/lib/i18n/client'
import { LOCALE_NAMES, LOCALES, type Locale } from '@/lib/i18n/config'
import { CheckIcon, GlobeIcon } from './icons'
import { Sheet } from './sheet'

/**
 * Tombol bahasa (ikon bola dunia + kode bahasa aktif) yang membuka daftar
 * bahasa di bottom sheet. Daftar memakai nama bahasa dalam bahasanya sendiri
 * dan atribut `lang`, supaya terbaca benar oleh screen reader (DESIGN.md 10).
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const t = useDict(commonCopy).language
  const [open, setOpen] = useState(false)

  function choose(next: Locale) {
    if (next !== locale) {
      // Menutup sheet memundurkan history (tombol Back Android). Ganti bahasa
      // setelah itu selesai, supaya router tidak memulihkan halaman lama dari cache.
      let applied = false
      const apply = () => {
        if (applied) return
        applied = true
        setLocale(next)
      }
      window.addEventListener('popstate', () => window.setTimeout(apply, 0), { once: true })
      window.setTimeout(apply, 400)
    }
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${t.button}: ${LOCALE_NAMES[locale]}`}
        className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border-[1.5px] border-brand-text px-3 font-bold text-brand-text uppercase active:scale-95 ${className}`}
      >
        <GlobeIcon className="size-[18px]" />
        {locale}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t.sheetTitle}
        description={t.sheetDescription}
      >
        <ul role="list" className="flex flex-col gap-2 pb-2">
          {LOCALES.map((code) => {
            const active = code === locale
            return (
              <li key={code}>
                <button
                  type="button"
                  lang={code}
                  aria-pressed={active}
                  onClick={() => choose(code)}
                  className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border-[1.5px] px-4 text-left font-semibold ${
                    active ? 'border-brand-text text-brand-text' : 'border-muted/40 text-ink'
                  }`}
                >
                  {LOCALE_NAMES[code]}
                  {active && <CheckIcon />}
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>
    </>
  )
}
