import Link from 'next/link'
import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { ChevronRightIcon } from './icons'

type PersonCardProps = {
  name: string
  subtitle?: ReactNode
  /** Isi kanan, mis. gaji. */
  trailing?: ReactNode
  /** Kalau diisi, kartu bisa dibuka dan menampilkan chevron (DESIGN.md 5.3). */
  href?: string
}

export function PersonCard({ name, subtitle, trailing, href }: PersonCardProps) {
  const body = (
    <>
      <Avatar name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title text-brand-text">{name}</span>
        {subtitle && <span className="block truncate text-label text-muted">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right">{trailing}</span>}
      {href && <ChevronRightIcon className="shrink-0 text-brand-text" />}
    </>
  )
  const className =
    'flex min-h-16 items-center gap-3 rounded-xl border-[1.5px] border-brand-text bg-surface p-3'

  if (href) {
    return (
      <Link href={href} className={`${className} active:scale-[0.99]`}>
        {body}
      </Link>
    )
  }
  return <div className={className}>{body}</div>
}
