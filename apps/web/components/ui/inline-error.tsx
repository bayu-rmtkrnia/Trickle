import type { ReactNode } from 'react'
import { buttonClass } from './button'
import { AlertIcon } from './icons'
import Link from 'next/link'

export type ErrorAction = { label: string; onClick: () => void } | { label: string; href: string }

type InlineErrorProps = {
  title: string
  message?: ReactNode
  action?: ErrorAction
  icon?: ReactNode
  /** `inline` = kotak di dalam halaman; `page` = isi utama layar (halaman undangan). */
  variant?: 'inline' | 'page'
}

/** Ikon + judul + pesan + satu aksi (DESIGN.md 5.9, 7.4). Tidak pernah menampilkan `code` mentah. */
export function InlineError({
  title,
  message,
  action,
  icon,
  variant = 'inline',
}: InlineErrorProps) {
  const actionEl =
    action &&
    ('href' in action ? (
      <Link
        href={action.href}
        className={buttonClass(variant === 'page' ? 'primary' : 'secondary', variant === 'page')}
      >
        {action.label}
      </Link>
    ) : (
      <button
        type="button"
        onClick={action.onClick}
        className={buttonClass(variant === 'page' ? 'primary' : 'secondary', variant === 'page')}
      >
        {action.label}
      </button>
    ))

  if (variant === 'page') {
    return (
      <section role="alert" className="flex flex-col items-center gap-3 text-center">
        <span className="grid size-14 place-items-center rounded-full border-[1.5px] border-danger text-danger">
          {icon ?? <AlertIcon className="size-7" />}
        </span>
        <h1 className="text-xl/7 font-bold">{title}</h1>
        {message && <p className="text-muted">{message}</p>}
        {actionEl && <div className="mt-4 w-full">{actionEl}</div>}
      </section>
    )
  }

  return (
    <div role="alert" className="flex gap-3 rounded-xl border-[1.5px] border-danger bg-surface p-4">
      <span className="mt-0.5 shrink-0 text-danger">{icon ?? <AlertIcon />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-danger">{title}</p>
        {message && <p className="mt-1 text-label text-ink">{message}</p>}
        {actionEl && <div className="mt-3">{actionEl}</div>}
      </div>
    </div>
  )
}
