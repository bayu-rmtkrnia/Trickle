import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

/**
 * Header dashboard (perusahaan, pekerja, keluarga) dengan pilihan bahasa dan tema.
 * Mobile-first: di HP avatar disembunyikan dan nama turun ke baris kedua supaya
 * tombol tetap muat sampai lebar 320 px; mulai `sm` semuanya satu baris.
 */
export function DashboardHeader({
  name,
  avatarName,
  nameLabel,
  action,
  end,
}: {
  name?: string
  avatarName?: string
  nameLabel?: string
  /** Aksi utama, sebelum bahasa dan tema (mis. "Undang pekerja" di desktop). */
  action?: ReactNode
  /** Setelah bahasa dan tema (mis. tombol keluar). */
  end?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 px-4 py-2.5 sm:min-h-16 sm:flex-nowrap sm:py-0">
        <Logo height={24} priority />
        {name && (
          // Satu elemen: di HP pindah ke baris kedua (order-last + lebar penuh), di `sm` ke tengah.
          <p className="order-last min-w-0 basis-full truncate pt-1 text-label text-muted sm:order-none sm:flex-1 sm:basis-auto sm:pt-0">
            {nameLabel && <span className="sr-only">{nameLabel} </span>}
            {name}
          </p>
        )}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          {action}
          <LanguageSwitcher />
          <ThemeToggle />
          {end}
          {name && (
            <span className="hidden sm:block">
              <Avatar name={avatarName ?? name} />
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
