'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { commonCopy } from '@/lib/copy/common'
import { useDict } from '@/lib/i18n/client'
import { THEME_STORAGE_KEY, type Theme } from '@/lib/theme'
import { MoonIcon, SunIcon } from './icons'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Tema yang sedang tampil: pilihan pengguna kalau ada, selain itu tema sistem. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = window.matchMedia(DARK_QUERY)
  media.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', onChange)
  }
}

/** Samakan warna bar status browser dengan token `bg` tema yang dipilih (DESIGN.md 11.2). */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!bg) return
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', bg)
  })
}

/**
 * Tombol ganti tema terang/gelap. Ikon menunjukkan tema tujuan: bulan saat
 * terang, matahari saat gelap. Pilihan disimpan di browser; skrip di <head>
 * (lib/theme.ts) memasangnya lagi sebelum halaman tampil.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  // Di server tema belum diketahui (null), jadi ikon baru muncul setelah hidrasi.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null)
  const t = useDict(commonCopy).theme

  useEffect(() => {
    if (document.documentElement.dataset.theme) syncThemeColor()
  }, [])

  function toggle() {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    const root = document.documentElement
    root.dataset.theme = next
    root.style.colorScheme = next
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Penyimpanan diblokir: tema tetap berganti untuk halaman ini.
    }
    syncThemeColor()
  }

  const label = theme === 'dark' ? t.toLight : theme === 'light' ? t.toDark : t.toggle
  const icon = (visible: boolean) =>
    [
      'absolute inset-0 m-auto transition-[transform,opacity] duration-300 ease-trickle',
      visible ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0',
    ].join(' ')

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`relative grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-brand-text text-brand-text active:scale-95 ${className}`}
    >
      <MoonIcon className={icon(theme === 'light')} />
      <SunIcon className={icon(theme === 'dark')} />
    </button>
  )
}
