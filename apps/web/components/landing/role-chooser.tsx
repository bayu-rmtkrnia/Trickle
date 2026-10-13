'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { BuildingIcon, ChevronRightIcon, UserIcon } from '@/components/ui/icons'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { landingCopy } from '@/lib/copy/landing'
import { useLocale } from '@/lib/i18n/client'
import { onSplashDone } from '@/lib/splash'
import styles from './role-chooser.module.css'

const LANDING_ROOT_ID = 'landing-root'
const FADE_MS = 300

/** Kunci halaman di belakang: landing tidak bisa difokus/discroll, animasi hero ditahan. */
function lockPage() {
  document.documentElement.dataset.chooser = 'open'
  document.getElementById(LANDING_ROOT_ID)?.setAttribute('inert', '')
  document.body.style.overflow = 'hidden'
}

function unlockPage() {
  delete document.documentElement.dataset.chooser
  document.getElementById(LANDING_ROOT_ID)?.removeAttribute('inert')
  document.body.style.overflow = ''
}

/**
 * Layar pilihan "pekerja atau perusahaan" untuk kunjungan pertama ke `/`.
 * Dirender server hanya kalau belum ada pilihan tersimpan, jadi tampil sejak
 * awal tanpa kedipan, di bawah splash. Selama terbuka, landing di belakangnya
 * dibuat `inert` (tidak bisa difokus) dan animasi hero ditahan.
 */
export function RoleChooser() {
  const router = useRouter()
  const { locale } = useLocale()
  const t = landingCopy[locale].chooser
  const [closing, setClosing] = useState(false)
  const [gone, setGone] = useState(false)
  const firstOption = useRef<HTMLButtonElement>(null)

  // Kunci halaman di belakang selama layar pilihan terbuka; fokus ke pilihan pertama setelah splash.
  useEffect(() => {
    lockPage()
    const stop = onSplashDone(() => firstOption.current?.focus({ preventScroll: true }))
    return () => {
      stop()
      unlockPage()
    }
  }, [])

  /** `browse` = "Lihat dulu saja": tutup layar ini dan tampilkan landing pekerja. */
  function choose(choice: 'worker' | 'company' | 'browse') {
    if (choice === 'company') {
      // Layar ini tetap menutupi sampai halaman perusahaan selesai dimuat.
      router.push('/perusahaan')
      return
    }
    // Buka kunci lebih awal supaya animasi hero berjalan bersamaan dengan memudarnya layar ini.
    unlockPage()
    setClosing(true)
    window.setTimeout(() => setGone(true), FADE_MS)
  }

  if (gone) return null

  const order = (i: number) => ({ '--chooser-i': i }) as CSSProperties
  const options = [
    { choice: 'worker' as const, Icon: UserIcon, ...t.worker },
    { choice: 'company' as const, Icon: BuildingIcon, ...t.company },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chooser-title"
      className={`${styles.overlay} ${closing ? styles.closing : ''} fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-bg`}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-[calc(24px+env(safe-area-inset-bottom))]">
        <div className="flex min-h-14 items-center justify-end">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 flex-col justify-center gap-8 py-6">
          <div className={`${styles.item} flex justify-center`} style={order(0)}>
            <Logo height={44} priority />
          </div>

          <h1
            id="chooser-title"
            className={`${styles.item} text-center text-2xl/8 font-bold`}
            style={order(1)}
          >
            {t.title}
          </h1>

          <ul className="flex flex-col gap-3">
            {options.map(({ choice, Icon, title, body }, i) => (
              <li key={choice} className={styles.item} style={order(2 + i)}>
                <button
                  ref={i === 0 ? firstOption : undefined}
                  type="button"
                  onClick={() => choose(choice)}
                  className="flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-brand-text bg-surface p-4 text-left transition-transform duration-120 active:scale-[0.98]"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-fill text-on-brand">
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-title text-brand-text">{title}</span>
                    <span className="mt-0.5 block text-label text-muted">{body}</span>
                  </span>
                  <ChevronRightIcon className="shrink-0 text-brand-text" />
                </button>
              </li>
            ))}
          </ul>

          <div className={`${styles.item} flex flex-col items-center gap-3`} style={order(4)}>
            <button
              type="button"
              onClick={() => choose('browse')}
              className="min-h-11 rounded-xl px-4 font-bold text-brand-text underline underline-offset-4"
            >
              {t.browse}
            </button>
            <p className="text-center text-label text-muted">{t.note}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
